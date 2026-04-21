import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import JSZip from 'jszip'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120_000,
})

// ── Text extractors ───────────────────────────────────────────────────────────

function stripXml(xml: string): string {
  return xml
    .replace(/<w:p[ >]/gi, '\n<w:p>')
    .replace(/<a:p[ >]/gi, '\n<a:p>')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractTextDocx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')?.async('string') ?? ''
  return stripXml(xml).slice(0, 80_000)
}

async function extractTextPptx(buf: ArrayBuffer): Promise<string> {
  const zip    = await JSZip.loadAsync(buf)
  const slides: string[] = []
  zip.forEach(path => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) slides.push(path)
  })
  const parts = await Promise.all(
    slides.sort().map(async p => {
      const xml = await zip.file(p)?.async('string') ?? ''
      return stripXml(xml)
    })
  )
  return parts.join('\n').slice(0, 80_000)
}

async function extractTextXlsx(buf: ArrayBuffer): Promise<string> {
  const zip     = await JSZip.loadAsync(buf)
  const shared  = await zip.file('xl/sharedStrings.xml')?.async('string') ?? ''
  const matches = shared.match(/<t[^>]*>([^<]*)<\/t>/g) ?? []
  return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').slice(0, 80_000)
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function existingDataSection(data: Record<string, unknown>): string {
  // Serialize only non-empty fields to keep the context lean
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined && v !== '' && v !== 0) clean[k] = v
  }
  if (Object.keys(clean).length === 0) return ''
  return `\n\nDADOS JÁ CONHECIDOS SOBRE ESTE ATIVO (não perca informações já preenchidas — melhore e complete):
${JSON.stringify(clean, null, 2)}\n`
}

function buildPromptCredito(existingData?: Record<string, unknown>): string {
  return `Você é um especialista em análise de contratos financeiros brasileiros.
Analise o documento${existingData ? ' e os dados já conhecidos abaixo' : ''} e extraia as informações listadas.
Retorne APENAS JSON válido, sem texto adicional.
Onde já houver dados, mantenha-os e os melhore se o documento oferecer informação mais precisa.
Use null APENAS para campos que não encontrar com confiança nem nos dados existentes.${existingData ? existingDataSection(existingData) : ''}

{
  "devedor": "nome completo do devedor ou tomador do crédito",
  "tipoPessoa": "PF" ou "PJ",
  "cnpjCpf": "CPF (000.000.000-00) ou CNPJ (00.000.000/0001-00)",
  "valorPrincipal": número em BRL sem símbolo de moeda,
  "taxaJuros": "ex: CDI+4% a.a. ou 12% a.a.",
  "dataVencimento": "DD/MM/AAAA",
  "tipoInstrumento": um de ["CCB","CCI","Mútuo","Debênture","CRA","CRI","Nota Promissória","Outro"],
  "garantias": "descrição das garantias ou colaterais",
  "statusCredito": "ativo",
  "observacoes": "cláusulas ou informações relevantes adicionais — integre ao que já existia (máx. 400 chars)",
  "resumo": "resumo executivo em 2-4 frases em português integrando todos os dados conhecidos sobre esta operação de crédito"
}`
}

function buildPromptParticipacao(existingData?: Record<string, unknown>): string {
  return `Você é um especialista em análise de contratos societários e estruturas empresariais brasileiras.
Analise o documento${existingData ? ' e os dados já conhecidos abaixo' : ''} e extraia as informações listadas.
Retorne APENAS JSON válido, sem texto adicional.
Onde já houver dados, mantenha-os e os melhore se o documento oferecer informação mais precisa.
Para o campo "empresa", prefira sempre a razão social oficial completa conforme consta no documento ou CNPJ.
Use null APENAS para campos que não encontrar com confiança nem nos dados existentes.${existingData ? existingDataSection(existingData) : ''}

{
  "empresa": "razão social completa e oficial da empresa conforme contrato ou consulta CNPJ",
  "cnpj": "CNPJ formatado (00.000.000/0001-00)",
  "percentual": número representando o percentual de participação do titular,
  "naturezaJuridica": "ex: Ltda, S/A, EIRELI, ME, EPP",
  "valorPatrimonial": número em BRL do valor patrimonial ou de aquisição,
  "metodoAvaliacao": um de ["Valor Patrimonial","EBITDA múltiplo","Fluxo de Caixa Descontado","Valor de Mercado","Custo histórico","Outro"],
  "outrosSocios": [{"nome":"...", "percentual": número}],
  "observacoes": "informações relevantes adicionais — integre ao que já existia (máx. 400 chars)",
  "resumo": "resumo executivo em 2-4 frases em português integrando todos os dados conhecidos sobre esta participação societária"
}`
}

// Inference-only prompt: no document, just structured data → infer best title + summary
function buildPromptInferTitle(docType: 'credito' | 'participacao', existingData: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(existingData)) {
    if (v !== null && v !== undefined && v !== '' && v !== 0) clean[k] = v
  }

  if (docType === 'participacao') {
    return `Você é especialista em empresas brasileiras. Com base nos dados estruturados abaixo, infira:
1. A razão social mais provável e precisa da empresa (use CNPJ para identificar se possível)
2. Um resumo executivo conciso integrando tudo que é conhecido

Retorne APENAS JSON válido.

DADOS DISPONÍVEIS:
${JSON.stringify(clean, null, 2)}

{
  "empresa": "razão social mais precisa e oficial inferida dos dados",
  "resumo": "resumo executivo em 2-3 frases integrando todos os dados disponíveis sobre esta participação"
}`
  }

  return `Você é especialista em crédito privado brasileiro. Com base nos dados estruturados abaixo, infira:
1. O nome mais preciso e completo do devedor
2. Um resumo executivo conciso integrando tudo que é conhecido

Retorne APENAS JSON válido.

DADOS DISPONÍVEIS:
${JSON.stringify(clean, null, 2)}

{
  "devedor": "nome mais preciso e completo inferido dos dados",
  "resumo": "resumo executivo em 2-3 frases integrando todos os dados disponíveis sobre esta operação"
}`
}

// ── JSON parse helper ─────────────────────────────────────────────────────────

function parseClaudeJson(raw: string): Record<string, unknown> | null {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr   = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : raw
  try {
    return JSON.parse(jsonStr.trim())
  } catch {
    return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      storagePath?: string
      docType: 'credito' | 'participacao'
      existingData?: Record<string, unknown>
      inferOnly?: boolean   // true → no document, just infer from existingData
    }

    const { docType, existingData, inferOnly } = body
    const storagePath = body.storagePath

    if (!docType) {
      return NextResponse.json({ error: 'docType é obrigatório' }, { status: 400 })
    }

    // ── Inference-only mode (no document) ────────────────────────────────────
    if (inferOnly || !storagePath) {
      if (!existingData || Object.keys(existingData).length === 0) {
        return NextResponse.json({ error: 'existingData é obrigatório no modo inferOnly' }, { status: 400 })
      }

      const prompt = buildPromptInferTitle(docType, existingData)
      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages:   [{ role: 'user', content: prompt }],
      })

      const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
      const fields = parseClaudeJson(raw)
      if (!fields) {
        return NextResponse.json({ error: 'Claude não retornou JSON válido' }, { status: 500 })
      }
      Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k] })
      return NextResponse.json({ fields, resumo: String(fields.resumo ?? '') })
    }

    // ── Document interpretation mode ─────────────────────────────────────────

    // 1. Download file from Supabase storage
    const supabase = createAdminClient()
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('documentos-vitais')
      .download(storagePath)

    if (dlErr || !fileData) {
      return NextResponse.json({ error: `Falha ao baixar arquivo: ${dlErr?.message ?? 'não encontrado'}` }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const fileExt     = storagePath.split('.').pop()?.toLowerCase() ?? ''
    const prompt      = docType === 'credito'
      ? buildPromptCredito(existingData)
      : buildPromptParticipacao(existingData)

    // 2. Build Claude message depending on file type
    let message: Anthropic.MessageParam

    if (fileExt === 'pdf') {
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      message = {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as Anthropic.DocumentBlockParam,
          { type: 'text', text: prompt },
        ],
      }
    } else {
      let text = ''
      if (fileExt === 'docx' || fileExt === 'doc') {
        text = await extractTextDocx(arrayBuffer)
      } else if (fileExt === 'pptx' || fileExt === 'ppt') {
        text = await extractTextPptx(arrayBuffer)
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        text = await extractTextXlsx(arrayBuffer)
      } else {
        text = Buffer.from(arrayBuffer).toString('utf-8').slice(0, 80_000)
      }

      if (!text.trim()) {
        return NextResponse.json({ error: 'Não foi possível extrair texto deste arquivo' }, { status: 422 })
      }

      message = {
        role: 'user',
        content: `${prompt}\n\n---CONTEÚDO DO DOCUMENTO---\n${text}`,
      }
    }

    // 3. Call Claude
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [message],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const fields = parseClaudeJson(raw)

    if (!fields) {
      console.error('[interpret-doc] JSON parse failed. Raw:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Claude não retornou JSON válido' }, { status: 500 })
    }

    Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k] })

    return NextResponse.json({ fields, resumo: String(fields.resumo ?? '') })

  } catch (err) {
    console.error('[interpret-doc] error:', err)
    return NextResponse.json({ error: 'Erro interno ao interpretar documento' }, { status: 500 })
  }
}
