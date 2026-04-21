import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import { ImovelRecord, DeedCheckData, DeedCheckFlag } from '@/lib/types/playbook'

const BUCKET = 'documentos-vitais'

// ── Extraction prompt ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Você é um especialista em análise de matrículas de imóveis brasileiras.
Analise o documento PDF fornecido (matrícula de imóvel) e extraia as seguintes informações em formato JSON estrito.
Responda SOMENTE com o JSON, sem texto adicional, sem markdown.

Campos a extrair:
{
  "numeroMatricula": "número da matrícula (string)",
  "proprietarioRegistrado": "nome completo do(s) proprietário(s) conforme matrícula",
  "areaRegistrada": "área total registrada com unidade (ex: 120,00m²)",
  "valorAquisicaoRegistrado": número em reais (null se não constar),
  "dataAquisicao": "data de aquisição no formato DD/MM/AAAA (null se não constar)",
  "onus": "hipoteca, penhora, usufruto, ou 'Nenhum' se matrícula limpa",
  "cartorioRegistrado": "nome do cartório de registro"
}

Se algum campo não constar no documento, use null.`

// ── Comparison engine ─────────────────────────────────────────────────────────

interface Extracted {
  numeroMatricula?: string | null
  proprietarioRegistrado?: string | null
  areaRegistrada?: string | null
  valorAquisicaoRegistrado?: number | null
  dataAquisicao?: string | null
  onus?: string | null
  cartorioRegistrado?: string | null
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function runDeedCheck(extracted: Extracted, imovel: ImovelRecord): DeedCheckData {
  const flags: DeedCheckFlag[] = []

  // Matricula number match
  if (extracted.numeroMatricula && imovel.matricula) {
    const eNum = normalize(extracted.numeroMatricula)
    const iNum = normalize(imovel.matricula)
    if (eNum !== iNum) {
      flags.push({
        campo: 'matricula',
        irpf: imovel.matricula,
        matricula: extracted.numeroMatricula ?? '',
        severidade: 'warning',
      })
    }
  }

  // Area comparison (strip non-numeric, compare as float)
  if (extracted.areaRegistrada && imovel.areaTotal) {
    const eArea = parseFloat((extracted.areaRegistrada ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    const iArea = parseFloat((imovel.areaTotal ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    if (!isNaN(eArea) && !isNaN(iArea) && Math.abs(eArea - iArea) > 1) {
      flags.push({
        campo: 'areaTotal',
        irpf: imovel.areaTotal ?? '',
        matricula: extracted.areaRegistrada ?? '',
        severidade: 'warning',
      })
    }
  }

  // Valor aquisição vs valorDeclarado — tolerance: 20%
  if (extracted.valorAquisicaoRegistrado && imovel.valorDeclarado > 0) {
    const ratio = Math.abs(extracted.valorAquisicaoRegistrado - imovel.valorDeclarado) / imovel.valorDeclarado
    if (ratio > 0.20) {
      flags.push({
        campo: 'valorDeclarado',
        irpf: String(imovel.valorDeclarado),
        matricula: String(extracted.valorAquisicaoRegistrado),
        severidade: 'warning',
      })
    }
  }

  // Onus check — flag if not clean
  const onus = normalize(extracted.onus)
  if (onus && onus !== 'nenhum' && onus !== 'sem ônus' && onus !== '') {
    flags.push({
      campo: 'onus',
      irpf: '—',
      matricula: extracted.onus ?? '',
      severidade: 'required',
    })
  }

  const status = flags.length === 0
    ? 'ok'
    : flags.some(f => f.severidade === 'required')
      ? 'divergencia'
      : 'parcial'

  return {
    status,
    verificadoEm: new Date().toISOString(),
    numeroMatricula: extracted.numeroMatricula ?? undefined,
    proprietarioRegistrado: extracted.proprietarioRegistrado ?? undefined,
    areaRegistrada: extracted.areaRegistrada ?? undefined,
    valorAquisicaoRegistrado: extracted.valorAquisicaoRegistrado ?? undefined,
    dataAquisicao: extracted.dataAquisicao ?? undefined,
    onus: extracted.onus ?? undefined,
    cartorioRegistrado: extracted.cartorioRegistrado ?? undefined,
    flags,
    rawExtraction: JSON.stringify(extracted),
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      storagePath: string
      imovelData: ImovelRecord
    }

    const { storagePath, imovelData } = body

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath obrigatório' }, { status: 400 })
    }

    // 1. Download PDF from Supabase Storage
    const supabase = createAdminClient()
    const { data: fileData, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath)

    if (dlError || !fileData) {
      return NextResponse.json(
        { error: dlError?.message ?? 'Falha ao baixar arquivo' },
        { status: 500 }
      )
    }

    // 2. Convert Blob → base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // 3. Call Anthropic API with PDF document source
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const docBlock: DocumentBlockParam = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    }

    const textBlock: TextBlockParam = {
      type: 'text',
      text: EXTRACTION_PROMPT,
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [docBlock, textBlock],
        },
      ],
    })

    // 4. Parse response
    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    let extracted: Extracted = {}
    try {
      // Strip markdown fences if present
      const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: 'Falha ao parsear resposta do modelo', raw: rawText },
        { status: 422 }
      )
    }

    // 5. Compare against imovel data
    const deedCheck = runDeedCheck(extracted, imovelData)

    return NextResponse.json(deedCheck)
  } catch (err) {
    console.error('[deed-check]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
