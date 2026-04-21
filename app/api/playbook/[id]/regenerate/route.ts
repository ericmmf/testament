import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generatePlaybook,
  applyAdvisorClassifications,
  applyOutrosBensReclassifications,
  outrosBemKey,
  outrosBemEDireitoKey,
} from '@/lib/generators/playbook-generator'
import { extractIRPFFromPDF } from '@/lib/parsers/pdf-extractor'
import { IRPFData } from '@/lib/types/irpf'
import { PlaybookData, OutroBemItem, OutroBemEDireitoRecord, InstituicaoFinanceira } from '@/lib/types/playbook'

// POST /api/playbook/[id]/regenerate
// For PDF uploads: re-downloads the stored PDF and re-runs the Anthropic extractor
// with the current prompt, then re-runs the playbook generator.
// For DEC uploads: skips re-extraction (DEC parsing is deterministic) and only
// re-runs the generator.
// Always preserves all manually entered fields from the existing playbook.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // ?reextract=false — skip PDF download+extraction, use stored parsed_data as-is.
    // Used by the re-upload flow (extraction already ran during upload).
    const url = new URL(req.url)
    const skipReextract = url.searchParams.get('reextract') === 'false'
    const supabase = createAdminClient()

    // 1. Fetch current playbook
    const { data: playbook, error: pbError } = await supabase
      .from('playbooks')
      .select('id, client_id, playbook_data')
      .eq('id', id)
      .single()

    if (pbError || !playbook) {
      console.error('[regenerate] Playbook not found, id:', id, 'error:', pbError?.message)
      return NextResponse.json({ error: 'Playbook não encontrado' }, { status: 404 })
    }

    const clientId: string = playbook.client_id
    const advisorId = 'advisor-default'
    const existing = playbook.playbook_data as PlaybookData

    // 2. Load the most recent IRPF upload for this client
    const { data: uploads, error: upError } = await supabase
      .from('irpf_uploads')
      .select('id, parsed_data, irpf_year, file_type, storage_path')
      .eq('client_id', clientId)
      .eq('parse_status', 'ok')
      .order('irpf_year', { ascending: false })
      .limit(1)

    if (upError || !uploads || uploads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum IRPF processado encontrado para este cliente.' },
        { status: 422 }
      )
    }

    const primary = uploads[0]
    let irpf = primary.parsed_data as IRPFData

    if (!irpf) {
      return NextResponse.json(
        { error: 'Dados do IRPF ausentes no registro de upload.' },
        { status: 422 }
      )
    }

    // 3. For PDF uploads: re-extract using the current prompt.
    //    Skipped when skipReextract=true (re-upload flow: extraction already ran).
    //    Skipped for DEC (deterministic — no benefit in re-running).
    if (!skipReextract && primary.file_type === 'pdf' && primary.storage_path) {
      console.log(`[regenerate] Re-extracting PDF for upload ${primary.id} (${primary.storage_path})`)

      // Mark upload as re-processing
      await supabase
        .from('irpf_uploads')
        .update({ parse_status: 'pending', parse_error: null })
        .eq('id', primary.id)

      let reextracted: IRPFData
      try {
        // Download the original PDF from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('irpf-files')
          .download(primary.storage_path)

        if (downloadError || !fileData) {
          throw new Error(`Falha ao baixar PDF do storage: ${downloadError?.message ?? 'arquivo não encontrado'}`)
        }

        const arrayBuffer = await fileData.arrayBuffer()
        reextracted = await extractIRPFFromPDF(arrayBuffer)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[regenerate] PDF re-extraction failed:', message)

        // Restore parse_status so the record isn't left in a pending state
        await supabase
          .from('irpf_uploads')
          .update({ parse_status: 'ok' })
          .eq('id', primary.id)

        return NextResponse.json(
          { error: `Falha na reextração do PDF: ${message}` },
          { status: 500 }
        )
      }

      // Persist the fresh parsed data
      await supabase
        .from('irpf_uploads')
        .update({ parsed_data: reextracted, parse_status: 'ok', parse_error: null })
        .eq('id', primary.id)

      irpf = reextracted
      console.log(`[regenerate] PDF re-extraction complete — ${irpf.bensEDireitos.length} bens extracted`)
    }

    // 4. Re-run generator with fresh IRPF data
    const fresh = generatePlaybook(irpf, clientId, advisorId)

    // 5. Merge: keep auto-generated asset sections from fresh run,
    //    preserve all manually entered fields from the existing playbook.
    let merged: PlaybookData = {
      ...fresh,

      // ── Preserve manually entered fields ───────────────────────────────────
      dadosPessoais: {
        ...fresh.dadosPessoais,
        cidadanias:          existing.dadosPessoais?.cidadanias          ?? fresh.dadosPessoais.cidadanias,
        ocupacao:            existing.dadosPessoais?.ocupacao            ?? fresh.dadosPessoais.ocupacao,
        email:               existing.dadosPessoais?.email               ?? fresh.dadosPessoais.email,
        telefone:            existing.dadosPessoais?.telefone            ?? fresh.dadosPessoais.telefone,
        certidaoCasamento:   existing.dadosPessoais?.certidaoCasamento,
        contatosEssenciais:  existing.dadosPessoais?.contatosEssenciais,
        documentosDropbox:   existing.dadosPessoais?.documentosDropbox,
        midiaFamiliar:       existing.dadosPessoais?.midiaFamiliar,
      },

      briefing:             existing.briefing,
      documentosVitais:     existing.documentosVitais,
      observacoesAdvisor:   existing.observacoesAdvisor,
      advisorReview:        existing.advisorReview,

      createdAt:  existing.createdAt,
      updatedAt:  new Date(),
      status:     existing.status,
    }

    // 6a. Merge outrosBensEDireitos:
    //     - Keep all existing items (advisor may have edited descriptions, notes, and reclassifications)
    //     - Add new items from fresh IRPF run not already in existing (dedup by key)
    {
      const existingOBEDMap = new Map<string, OutroBemEDireitoRecord>()
      for (const item of existing.outrosBensEDireitos ?? []) {
        existingOBEDMap.set(outrosBemEDireitoKey(item), item)
      }
      const mergedOBED = [...(existing.outrosBensEDireitos ?? [])]
      for (const freshItem of fresh.outrosBensEDireitos ?? []) {
        const key = outrosBemEDireitoKey(freshItem)
        if (!existingOBEDMap.has(key)) {
          mergedOBED.push(freshItem)
          console.log(`[regenerate] New outrosBens item from IRPF: ${freshItem.descricao.slice(0, 60)}`)
        }
      }
      merged.outrosBensEDireitos = mergedOBED.length > 0 ? mergedOBED : undefined
    }

    // 6b. Apply advisor reclassifications: items in outrosBensEDireitos with
    //     classificacaoAdvisor set to something other than 'outro_bem' are moved
    //     to their target section and removed from outrosBensEDireitos.
    const reclassCount = (merged.outrosBensEDireitos ?? []).filter(
      i => i.classificacaoAdvisor && i.classificacaoAdvisor !== 'outro_bem'
    ).length
    if (reclassCount > 0) {
      merged = applyOutrosBensReclassifications(merged)
      console.log(`[regenerate] Moved ${reclassCount} item(s) out of outrosBensEDireitos via advisor reclassification`)
    }

    // 6c. Backward compat: carry over advisor classifications from legacy outrosBens
    //     (playbooks created before the outrosBensEDireitos-first model).
    const existingClassMap = new Map<string, { classificacaoAdvisor: OutroBemItem['classificacaoAdvisor']; notaAdvisor?: string }>()
    for (const item of (existing.outrosBens ?? []) as OutroBemItem[]) {
      if (item.classificacaoAdvisor) {
        existingClassMap.set(outrosBemKey(item), {
          classificacaoAdvisor: item.classificacaoAdvisor,
          notaAdvisor: item.notaAdvisor,
        })
      }
    }
    if (existingClassMap.size > 0 && merged.outrosBens) {
      merged.outrosBens = merged.outrosBens.map(item => {
        const saved = existingClassMap.get(outrosBemKey(item))
        return saved ? { ...item, ...saved } : item
      })
      merged = applyAdvisorClassifications(merged)
      console.log(`[regenerate] Applied ${existingClassMap.size} legacy outrosBens classification(s)`)
    }

    // 6d. Merge instituicoesFinanceiras: keep existing contact info, add any new institutions from fresh run.
    const existingInstMap = new Map<string, InstituicaoFinanceira>(
      (existing.instituicoesFinanceiras ?? []).map(i => [i.nome, i])
    )
    const freshInsts = merged.instituicoesFinanceiras ?? []
    const mergedInsts: InstituicaoFinanceira[] = freshInsts.map(inst =>
      existingInstMap.get(inst.nome) ?? inst
    )
    for (const inst of existing.instituicoesFinanceiras ?? []) {
      if (!mergedInsts.find(i => i.nome === inst.nome)) {
        mergedInsts.push(inst)
      }
    }
    merged.instituicoesFinanceiras = mergedInsts.length > 0 ? mergedInsts : undefined

    // 8. Persist updated playbook
    const { error: updateError } = await supabase
      .from('playbooks')
      .update({
        playbook_data: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[regenerate] Playbook update error:', updateError)
      return NextResponse.json({ error: 'Erro ao salvar playbook regenerado' }, { status: 500 })
    }

    const reextracted = primary.file_type === 'pdf'
    console.log(`[regenerate] Playbook ${id} regenerated${reextracted ? ' (PDF re-extracted)' : ''} from IRPF year ${irpf.anoCalendario}`)

    return NextResponse.json({
      ok: true,
      reextracted,
      irpfYear: irpf.anoCalendario,
      reconciliation: irpf.totalBensEDireitosDeclarado
        ? {
            totalDeclarado: irpf.totalBensEDireitosDeclarado,
            totalExtracted: irpf.bensEDireitos.reduce((s, b) => s + b.situacaoAtual, 0),
          }
        : null,
      counts: {
        imoveis: merged.imoveis.length,
        ativos: merged.ativosFinanceiros.length,
        participacoes: merged.participacoesSocietarias.length,
        creditos: merged.creditos?.length ?? 0,
      },
    })

  } catch (err) {
    console.error('[regenerate] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
