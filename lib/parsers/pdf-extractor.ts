import Anthropic from '@anthropic-ai/sdk';
import { IRPFData } from '../types/irpf';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 300_000, // 5 minutes hard cap
});

// ── Number parser for Brazilian IRPF values ───────────────────────────────────
// Handles: 18086654.76 · 18.086.654,76 · 18086654,76 · 18.086.654.76 (malformed)
// Rule: if both . and , present → last is decimal, others are thousands.
//       if only , → decimal separator.
//       if only . → check count: >1 means thousands-only (integer), 1 means decimal.

function parseIRPFNumber(text: string): number {
  const s = text.replace(/[R$\s]/g, '').trim()
  const hasComma = s.includes(',')
  const dotCount = (s.match(/\./g) ?? []).length

  if (hasComma && dotCount > 0) {
    // Brazilian: 18.086.654,76
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (hasComma && dotCount === 0) {
    // 18086654,76
    return parseFloat(s.replace(',', '.'))
  }
  if (!hasComma && dotCount > 1) {
    // 18.086.654 (integer with dot thousands separators — no decimal)
    return parseFloat(s.replace(/\./g, ''))
  }
  // Single dot or no separator: standard float 18086654.76
  return parseFloat(s)
}

// ── Pass 1: extract control total deterministically ──────────────────────────
// Tiny focused query — returns only the "Bens e direitos em 31/12/XXXX" value.
// Isolated from the full extraction so the number is stable across runs.

async function extractControlTotal(base64PDF: string): Promise<number | null> {
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
            },
            {
              type: 'text',
              text: `Localize a seção "Evolução Patrimonial" neste PDF de IRPF brasileiro.
Nessa seção, encontre a linha que começa com "Bens e direitos em 31/12/" seguida de um ano (ex: 2023, 2024).
Se houver mais de uma linha "Bens e direitos em", use a de data mais recente.
Retorne SOMENTE o valor numérico dessa linha.
Formato obrigatório de saída: use PONTO como separador decimal e SEM separador de milhar.
Exemplos de saída correta: 18086654.76 ou 2500000.00
NÃO use vírgula. NÃO use ponto como separador de milhar. Apenas dígitos e um ponto decimal.
Não escreva mais nada além do número.`,
            },
          ],
        },
      ],
    });

    const raw = (res.content[0] as { type: string; text?: string }).text?.trim() ?? '';
    const value = parseIRPFNumber(raw)
    if (isNaN(value) || value <= 0) {
      console.warn('[pdf-extractor] Pass 1: could not parse control total from:', JSON.stringify(raw))
      return null
    }
    console.log(`[pdf-extractor] Pass 1: control total = ${value} (raw: "${raw}")`)
    return value
  } catch (err) {
    console.warn('[pdf-extractor] Pass 1 failed:', err)
    return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function extractIRPFFromPDF(
  pdfBuffer: ArrayBuffer
): Promise<IRPFData> {
  const base64PDF = Buffer.from(pdfBuffer).toString('base64');

  // Pass 1: get the control total before the main extraction
  const controlTotal = await extractControlTotal(base64PDF);

  // Pass 2: full extraction with control total injected as hard constraint
  const prompt = buildExtractionPrompt(controlTotal);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',  // Sonnet for Pass 2 — better instruction-following on long PDFs
    max_tokens: 32000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const content = response.content[0] as { type: string; text?: string };
  if (content.type !== 'text' || !content.text) {
    throw new Error('Resposta inesperada da API');
  }

  return parseExtractionResponse(content.text, controlTotal);
}

function buildExtractionPrompt(controlTotal: number | null): string {
  const totalLine = controlTotal !== null
    ? `TOTAL DE CONTROLE (extraído na pré-análise, valor fixo): ${controlTotal.toFixed(2)}
NÃO recalcule este total. NÃO leia o PDF para encontrá-lo. Use exatamente ${controlTotal.toFixed(2)}.
Coloque este valor no campo "totalBensEDireitosDeclarado" do JSON sem alteração.`
    : `TOTAL DE CONTROLE: não foi possível determinar na pré-análise.
Localize-o na seção "Evolução Patrimonial" → linha "Bens e direitos em 31/12/XXXX" (data mais recente).`

  return EXTRACTION_PROMPT_TEMPLATE.replace('__TOTAL_DE_CONTROLE__', totalLine)
}

const EXTRACTION_PROMPT_TEMPLATE = `
Você está analisando uma Declaração de Imposto de Renda (IRPF) brasileira em PDF.
Execute OBRIGATORIAMENTE todas as fases na ordem abaixo antes de gerar qualquer JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1 — TOTAL DE CONTROLE (valor já verificado externamente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

__TOTAL_DE_CONTROLE__

REGRA DE OURO: A soma de TODOS os valores "situacaoAtual" na lista bensEDireitos
DEVE ser exatamente igual (ou com diferença máxima de R$ 1,00 por arredondamento)
ao totalBensEDireitosDeclarado. Se não fechar, você AINDA não terminou a extração.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2 — VARREDURA COMPLETA DA FICHA "BENS E DIREITOS"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Percorra PÁGINA POR PÁGINA a ficha "Bens e Direitos" e extraia CADA item listado.
Não pule páginas. Não omita grupos. Todo item tem "Situação em 31/12/AAAA" — use esse valor
como "situacaoAtual".

GRUPO 01 — Bens Imóveis
  Apartamento, casa, terreno, lote, gleba, fazenda, sítio, sala comercial,
  galpão, loja, escritório, imóvel rural, garagem, vaga, hangar.
  → Para cada item: endereço completo, matrícula, cartório, área, data de aquisição.

GRUPO 02 — Bens Móveis
  01 = Automóvel, caminhonete, caminhão, motocicleta e similares
  02 = Embarcações
  03 = Aeronaves
  04 = Joias, pedras preciosas, objetos de arte e antiquidades
  05 = Outros bens móveis

GRUPO 03 — Participações Societárias e Ações
  01 = Ações negociadas em bolsa (CNPJ da empresa + ticker)
  02 = Quotas/quinhões em empresa privada (LTDA, S.A. fechada — CNPJ obrigatório)
  03 = Fundos de Ações (FIA, ETF, BDR)
  04 = Ouro / ativo financeiro
  05 = Consórcios
  99 = Outras participações
  → Para cada item: CNPJ, nome da empresa, % de participação.

GRUPO 04 — Aplicações e Investimentos Financeiros
  01 = Depósito bancário em moeda estrangeira
  02 = Quotas de fundos (uso legado — preferir Grupo 07 para fundos)
  03 = Títulos públicos e privados (CDB, LCI, LCA, CRI, CRA, debêntures, Tesouro Direto)
  04 = Ativos de renda variável não cotados em bolsa
  05 = PGBL / VGBL / Previdência Complementar
  06 = Operações de crédito privado (empréstimos concedidos como credor)
  07 = Conta corrente / conta poupança / conta de pagamento em banco nacional
  08 = Criptoativos (uso legado — preferir Grupo 08)
  99 = Outras aplicações e investimentos

GRUPO 05 — Créditos e Direitos com Pessoa Física
  Empréstimos a pessoas físicas, herança a receber, etc.

GRUPO 06 — Créditos e Direitos com Pessoa Jurídica
  Contas a receber de empresas, saldo em conta corrente de corretora,
  dividendos a receber, JCP a receber.

GRUPO 07 — Fundos de Investimento (CRÍTICO — não omitir nenhum)
  01 = Fundos de Investimento em geral (FIM, FICFI, FDO, FII, FIA, ETF, BDR)
  02 = Fundos de Investimento Imobiliário (FII)
  03 = Fundos de Previdência Complementar (PGBL/VGBL)
  04 = Fundos de Participações (FIP)
  99 = Outros fundos
  ATENÇÃO: Itens com rendimentos isentos (CRA, CRI, LCA, LCI dentro de fundos)
  costumam ter valores altos e NÃO podem ser ignorados.

GRUPO 08 — Criptoativos
  Bitcoin, Ethereum, stablecoins, tokens e demais ativos digitais.

GRUPO 09 — Trusts e Estruturas Similares no Exterior
  Trusts, offshores, holdings estrangeiras com declaração específica.

GRUPO 99 — Outros Bens e Direitos
  Tudo que não se enquadra nos grupos anteriores.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3 — VERIFICAÇÃO OBRIGATÓRIA ANTES DE GERAR O JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de escrever qualquer JSON, execute este cálculo mentalmente:

  SOMA_EXTRAÍDA = soma de todos os situacaoAtual de bensEDireitos
  TOTAL_CONTROLE = totalBensEDireitosDeclarado (da Fase 1)
  DIFERENÇA = |SOMA_EXTRAÍDA - TOTAL_CONTROLE|

Se DIFERENÇA > 1.00:
  → Você AINDA está incompleto. Volte à ficha Bens e Direitos e localize o(s) item(ns)
    faltante(s). Itens frequentemente omitidos:
    · Últimas páginas da ficha Bens e Direitos (não pare na penúltima página)
    · Fundos com rendimento isento (Grupo 07) — costumam ter valores altos
    · Participações societárias com CNPJ (Grupo 03, código 02)
    · Imóveis com situacaoAtual = 0 (vendidos no ano — incluir mesmo assim)
    · Contas bancárias com saldo baixo que somam para fechar o total
  → Só gere o JSON quando DIFERENÇA ≤ 1.00.

Se mesmo após revisão completa a diferença persistir, registre em confidenceNotes:
  "[reconciliação manual] Soma extraída: X. Total declarado: Y. Diferença: Z. Item(ns)
   possivelmente na página [N] da ficha Bens e Direitos — verificar com o cliente."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS CRÍTICAS DE CLASSIFICAÇÃO — NÃO IGNORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Grupo "01" é EXCLUSIVO para imóveis físicos. JAMAIS use grupo "01" para
   contas bancárias, saldos, investimentos ou qualquer ativo financeiro.

2. Se a discriminação menciona banco ou corretora (XP, Itaú, Bradesco, BTG,
   Nubank, Santander, Caixa, BB, Safra, Inter, C6, Warren, NuInvest, Órama,
   Clear, Rico, Ágora, Guide, Avenue, etc.), o grupo DEVE ser 04, 06 ou 07,
   NUNCA 01.

3. Fundos de qualquer tipo (FIM, FICFI, FDO, FII, FIA, ETF, BDR, FIP) → Grupo 07.

4. Tesouro Direto (NTN-B, NTN-F, LFT, LTN), CDB, LCI, LCA, CRI, CRA → Grupo 04, código 03.

5. PGBL / VGBL → Grupo 04, código 05 (ou Grupo 07, código 03).

6. Conta corrente / poupança em banco nacional → Grupo 04, código 07.

7. Empresa privada com CNPJ → Grupo 03, código 02.

8. Ações em bolsa (ticker de 4 letras + dígito) → Grupo 03, código 01.

9. Na discriminação: inclua SEMPRE o nome da instituição financeira, CNPJ e
   tipo do produto quando mencionados no documento.

10. Não omita nenhum item. Imóveis com situacaoAtual = 0 (vendidos) devem ser incluídos.
    A soma deve fechar com o totalBensEDireitosDeclarado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA JSON DE SAÍDA (retorne APENAS o JSON, sem texto adicional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "anoCalendario": número,
  "totalBensEDireitosDeclarado": número (da linha "Bens e direitos em 31/12/AAAA" da Evolução Patrimonial),
  "dadosDeclarante": {
    "cpf": "string",
    "nome": "string",
    "dataNascimento": "string ou null",
    "ocupacaoPrincipal": "string ou null",
    "logradouro": "string ou null",
    "numero": "string ou null",
    "complemento": "string ou null",
    "bairro": "string ou null",
    "municipio": "string ou null",
    "uf": "string ou null",
    "cep": "string ou null",
    "telefone": "string ou null",
    "email": "string ou null"
  },
  "dependentes": [
    {
      "nome": "string",
      "cpf": "string ou null",
      "dataNascimento": "string ou null",
      "relacao": "string"
    }
  ],
  "bensEDireitos": [
    {
      "grupo": "string (2 dígitos, ex: '07')",
      "codigo": "string (2 dígitos, ex: '01')",
      "discriminacao": "string — inclua sempre nome da instituição, CNPJ e tipo do produto",
      "situacaoAnterior": número,
      "situacaoAtual": número,
      "localizacao": "string ou null",
      "cnpj": "string ou null",
      "paisLocalizacao": "string ou null"
    }
  ],
  "dividas": [
    {
      "codigoCredor": "string",
      "cnpjCpfCredor": "string ou null",
      "descricao": "string",
      "saldoAnterior": número,
      "saldoAtual": número
    }
  ],
  "confidenceNotes": ["campos ilegíveis, ausentes, ambíguos ou itens onde houve incerteza na classificação"]
}

FORMATAÇÃO:
- Valores monetários: números sem R$, sem pontos de milhar, vírgula → ponto decimal
- Campos ausentes: null (nunca string vazia, nunca invente dados)
- grupo e codigo: sempre 2 dígitos com zero à esquerda
- Imóveis vendidos no ano (situacaoAtual = 0): incluir no array com situacaoAtual: 0
`;

// ── Post-extraction sanitizer ─────────────────────────────────────────────────
// Safety net: scan grupo-01 items for financial keywords and override to grupo 04.
// Groups 07/08/09 are already financial by definition — they stay as-is.

const FINANCIAL_OVERRIDE_KEYWORDS = [
  'CONTA CORRENTE', 'CONTA POUPAN', 'CONTA INVEST', 'CONTA BANCARIA', 'CONTA BANCÁRIA',
  'SALDO', 'DEPOSITO', 'DEPÓSITO',
  'CDB', 'LCI', 'LCA', 'CRI', 'CRA', 'LFT', 'LTN', 'NTN',
  'TESOURO DIRETO', 'TESOURO SELIC', 'TESOURO IPCA', 'TESOURO PREFIXADO',
  'FUNDO', 'FDO', 'FIM', 'FIA', 'FICFI', 'FII', 'FIP', 'ETF', 'BDR',
  'PREVIDENCIA', 'PREVIDÊNCIA', 'PGBL', 'VGBL',
  'APLICACAO', 'APLICAÇÃO', 'RENDA FIXA', 'RENDA VARIAVEL', 'RENDA VARIÁVEL',
  'INVESTIMENTO', 'CARTEIRA',
  'BITCOIN', 'CRIPTO', 'ETHEREUM',
  'DEBENTURE', 'DEBÊNTURE',
  // Institution names
  'XP', 'ITAU', 'ITAÚ', 'BRADESCO', 'BTG', 'NUBANK', 'SANTANDER',
  'CAIXA ECONOMICA', 'CAIXA ECONÔMICA', 'BANCO DO BRASIL',
  'SAFRA', 'SICREDI', 'SICOOB', 'INTER', 'C6 BANK',
  'WARREN', 'NUINVEST', 'ORAMA', 'ÓRAMA', 'AVENUE', 'CLEAR',
  'RICO ', 'AGORA ', 'GUIDE', 'MODAL', 'SOFISA', 'GENIAL',
  'CORRETORA', 'DTVM', 'CCTVM',
]

function sanitizeBensEDireitos(
  bens: Array<Record<string, unknown>>,
  confidenceNotes: string[]
): Array<Record<string, unknown>> {
  return bens.map(b => {
    const grupo = String(b.grupo ?? '')

    // Groups 07/08/09 are always financial — correct to 04 if Haiku left them ambiguous
    // (they should stay as 07/08/09 — these are valid grupo values)
    if (grupo === '07' || grupo === '08' || grupo === '09') return b

    // Only sanitize items incorrectly assigned to grupo 01
    if (grupo !== '01') return b

    const disc = String(b.discriminacao ?? '').toUpperCase()
    const isFinancial = FINANCIAL_OVERRIDE_KEYWORDS.some(kw => disc.includes(kw))
    if (!isFinancial) return b

    const preview = String(b.discriminacao ?? '').slice(0, 70)
    confidenceNotes.push(
      `[sanitizer] Reclassificado grupo 01→04: "${preview}" — indicador financeiro detectado`
    )
    return { ...b, grupo: '04', codigo: b.codigo ?? '99' }
  })
}

function parseExtractionResponse(text: string, controlTotal: number | null = null): IRPFData {
  let cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[pdf-extractor] Raw response (first 5000 chars):', text.slice(0, 5000))
    throw new Error('Falha ao interpretar resposta JSON da extração por PDF')
  }

  const confidenceNotes: string[] = (parsed.confidenceNotes as string[]) || []
  confidenceNotes.push('Extraído via PDF — revisar todos os valores com o cliente')

  const rawBens: Array<Record<string, unknown>> = (
    (parsed.bensEDireitos as Array<Record<string, unknown>>) || []
  ).map(b => ({ ...b, source: 'pdf' as const }))

  const sanitizedBens = sanitizeBensEDireitos(rawBens, confidenceNotes)

  const reclassified = sanitizedBens.filter((b, i) => b.grupo !== rawBens[i].grupo).length
  if (reclassified > 0) {
    console.log(`[pdf-extractor] Sanitizer reclassified ${reclassified} item(s) from grupo 01→04`)
  }

  // Use the pre-verified control total from Pass 1 when available.
  // This overrides whatever the model wrote in totalBensEDireitosDeclarado,
  // eliminating variance in the reference value across runs.
  const totalDeclarado: number | undefined = controlTotal !== null
    ? controlTotal
    : (typeof parsed.totalBensEDireitosDeclarado === 'number' ? parsed.totalBensEDireitosDeclarado : undefined)
  if (totalDeclarado !== undefined) {
    const totalExtracted = sanitizedBens.reduce(
      (sum, b) => sum + (typeof b.situacaoAtual === 'number' ? b.situacaoAtual : 0), 0
    )
    const diff = Math.abs(totalExtracted - totalDeclarado)
    const pct = totalDeclarado > 0 ? (diff / totalDeclarado) * 100 : 0
    if (diff > 1) {
      const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format
      confidenceNotes.push(
        `[reconciliação] Divergência: total declarado ${fmt(totalDeclarado)} vs extraído ${fmt(totalExtracted)} ` +
        `(diferença ${fmt(diff)} = ${pct.toFixed(2)}%). Itens faltantes na ficha Bens e Direitos — reprocessar após revisar o PDF.`
      )
      console.warn(`[pdf-extractor] Reconciliation gap: ${fmt(diff)} (${pct.toFixed(2)}%)`)
    }
  }

  return {
    anoCalendario: (parsed.anoCalendario as number) || new Date().getFullYear() - 1,
    anoExercicio: ((parsed.anoCalendario as number) || new Date().getFullYear() - 1) + 1,
    dadosDeclarante: parsed.dadosDeclarante as IRPFData['dadosDeclarante'],
    dependentes: (parsed.dependentes as IRPFData['dependentes']) || [],
    bensEDireitos: sanitizedBens as IRPFData['bensEDireitos'],
    dividas: (parsed.dividas as IRPFData['dividas']) || [],
    totalBensEDireitosDeclarado: totalDeclarado,
    parsedAt: new Date(),
    sourceFormat: 'pdf',
    confidenceNotes,
  }
}
