// Playbook Generator — IRPFData → PlaybookData
// Classifies bens e direitos into typed sections, generates ReviewFlags.

import { IRPFData, BemOuDireito } from '@/lib/types/irpf'
import {
  PlaybookData,
  ImovelRecord,
  AtivoFinanceiro,
  ParticipacaoSocietaria,
  CreditoRecord,
  ReviewFlag,
  OutroBemItem,
  OutroBemEDireitoRecord,
  InstituicaoFinanceira,
} from '@/lib/types/playbook'

// ── IRPF grupo/codigo classification ─────────────────────────────────────────
// Grupo 01: Bens Imóveis
// Grupo 02: Bens Móveis (veículos — omitted from MVP playbook)
// Grupo 03: Participações Societárias
//   01 = Ações em bolsa        → always AtivoFinanceiro
//   02 = Quotas/quinhões       → ParticipacaoSocietaria if private (has CNPJ, not FII/ticker)
//   03 = Fundos de ações       → always AtivoFinanceiro
//   04 = Ouro, ativo financeiro → AtivoFinanceiro
//   05 = Consórcios            → AtivoFinanceiro
//   99 = Outras participações  → ParticipacaoSocietaria only if private (CNPJ + not bolsa)
// Grupo 04: Aplicações e Investimentos → AtivoFinanceiro
// Grupo 05: Créditos e Direitos       → AtivoFinanceiro
// Grupo 06: Outros                    → skip

const IMOVEL_GRUPOS = new Set(['01'])

// ── Bolsa / FII detection ─────────────────────────────────────────────────────
// Returns true if the asset is a listed instrument (stock, FII, ETF).
// These must go to AtivoFinanceiro, never to ParticipacaoSocietaria.

// Returns true for ANY listed/publicly-traded instrument.
// These must go to AtivoFinanceiro, NEVER to ParticipacaoSocietaria.
// Covers: stocks, FIIs, ETFs, BDRs, funds of any type, debentures, CRI, CRA.
function isBolsaOrFII(discriminacao: string): boolean {
  const upper = discriminacao.toUpperCase()

  // ── Full-word forms ────────────────────────────────────────────────────────
  if (/\bFII\b/.test(upper)) return true
  if (upper.includes('FUNDO IMOBILI')) return true
  if (upper.includes('FUNDO DE AÇÕES') || upper.includes('FUNDO DE ACOES')) return true
  if (upper.includes('FUNDO DE INVEST')) return true
  if (upper.includes('FUNDO MULTIMERCADO')) return true
  if (upper.includes('FUNDO DE RENDA FIXA')) return true
  if (/\bETF\b/.test(upper)) return true
  if (/\bBDR\b/.test(upper)) return true

  // ── DEC-file abbreviations (Receita Federal shortens fund names) ───────────
  // FDO = Fundo; FI = Fundo de Investimento; FICFI = FI Cotas FI
  if (/\bFDO\b/.test(upper)) return true              // Any "FDO" = Fundo variant
  if (/\bFICFI\b/.test(upper)) return true            // Fundo Invest Cotas FI
  if (/\bFIRF\b/.test(upper)) return true             // Fundo Invest Renda Fixa
  if (/\bFIM\b/.test(upper)) return true              // Fundo Invest Multimercado
  if (/\bFIA\b/.test(upper)) return true              // Fundo Invest Ações
  if (/\bFIP\b/.test(upper)) return true              // Fundo Invest Participações (listed)
  if (/\bFI\s+IMOB/.test(upper)) return true          // FI IMOBILIARIO
  if (/\bFI\s+ACOES\b/.test(upper)) return true
  if (/\bFI\s+MULTIM/.test(upper)) return true

  // ── Ações / equity keywords ────────────────────────────────────────────────
  if (/\bACAO\b/.test(upper)) return true
  if (/\bACOES\b/.test(upper)) return true
  if (upper.includes('ACOES ORDINARIAS') || upper.includes('ACOES PREFERE')) return true

  // ── Debt instruments traded in public markets ──────────────────────────────
  if (/\bDEB[EÊ]NTURE/.test(upper)) return true
  if (/\bCRI\b/.test(upper)) return true
  if (/\bCRA\b/.test(upper)) return true
  if (/\bLCI\b/.test(upper)) return true
  if (/\bLCA\b/.test(upper)) return true

  // ── Brazilian tickers: KNRI11, XPML11, VALE3, BBAS3, BOVA11 ──────────────
  // 4 uppercase letters + 1–2 digits, isolated word boundary
  if (/\b[A-Z]{4}\d{1,2}\b/.test(upper)) return true

  return false
}

// ── Classification logic ──────────────────────────────────────────────────────
// STRICT RULE: ParticipacaoSocietaria is EXCLUSIVE to private companies (LTDA / S.A. fechada).
// Any listed instrument — regardless of grupo/codigo — must be classified as AtivoFinanceiro.

// ── Créditos a Receber detection ──────────────────────────────────────────────
// Dividendos a receber, JCP, proventos — should go to CreditoRecord, not AtivoFinanceiro.

function isCreditoAReceber(discriminacao: string): boolean {
  const u = discriminacao.toUpperCase()
  if (u.includes('CREDITO DE DIVIDENDO') || u.includes('CRÉDITO DE DIVIDENDO')) return true
  if (u.includes('DIVIDENDOS A RECEBER')) return true
  if (u.includes('JUROS SOBRE CAPITAL PROPRIO') || u.includes('JCP A RECEBER')) return true
  if (u.includes('PROVENTOS A RECEBER')) return true
  if (u.includes('LUCROS A DISTRIBUIR') || u.includes('LUCROS A RECEBER')) return true
  return false
}

export type Category = 'imovel' | 'ativo_financeiro' | 'participacao' | 'credito' | 'skip'

// Exported for unit testing — do not use outside generator and tests
export { isBolsaOrFII, isCreditoAReceber, isFinancialAsset, classify }

// Real-estate signal words — if any appear in discriminacao, it cannot be a financial asset
// regardless of other keywords (e.g., "APLICACAO DE RECURSOS NA COMPRA DO IMOVEL").
const IMOVEL_KEYWORDS = [
  'IMOVEL', 'IMÓVEL', 'IMOBILIARIO', 'IMOBILIÁRIA', 'IMOBILIARIO',
  'APARTAMENTO', 'APTO ', ' APTO', 'RESIDENCIA', 'RESIDÊNCIA',
  'CASA ', ' CASA', 'SOBRADO', 'COBERTURA',
  'TERRENO', 'LOTE ', ' LOTE', 'LOTEAMENTO',
  'FAZENDA', 'SITIO', 'SÍTIO', 'CHACARA', 'CHÁCARA',
  'EDIFICIO', 'EDIFÍCIO', 'CONDOMINIO', 'CONDOMÍNIO',
  'SALA COMERCIAL', 'LOJA ', ' LOJA', 'GALPAO', 'GALPÃO',
  'MATRICULA DO IMOVEL', 'REGISTRO DE IMOVEL',
  'PRAIA DO', 'BARRA DO', 'BAIRRO ', 'RUA ', 'AV.', 'AVENIDA',
]

function hasImovelKeyword(u: string): boolean {
  return IMOVEL_KEYWORDS.some(kw => u.includes(kw))
}

// Participação societária signal words — routes item to participacao section.
// Applied AFTER isFinancialAsset so that FIPs (Fundo de Participações) are still
// caught by the FUNDO keyword first and stay in ativo_financeiro.
const PARTICIPACAO_KEYWORDS = [
  'PARTICIPACAO', 'PARTICIPAÇÃO',
  'PARTICIPACOES', 'PARTICIPAÇÕES',
  'QUOTA', 'QUOTAS',
  'COTA ', ' COTAS', 'COTAS ',  // word-bounded to avoid "COTACAO"
  'CAPITAL SOCIAL',
  'SOCIETARIA', 'SOCIETÁRIO', 'SOCIETARIO', 'SOCIETÁRIA',
  'SOCIO ', ' SOCIO', 'SÓCIO', 'SOCIA ', ' SOCIA',
]

function hasParticipacaoKeyword(u: string): boolean {
  return PARTICIPACAO_KEYWORDS.some(kw => u.includes(kw))
}

// Returns true for financial product keywords that can appear even in grupo 01
// when the PDF extractor misassigns the grupo (Haiku reads PDF layout, not DEC fields).
// IMPORTANT: always returns false when discriminacao contains real-estate signals,
// preventing properties with financial-sounding descriptions from being misrouted.
function isFinancialAsset(discriminacao: string): boolean {
  const u = discriminacao.toUpperCase()

  // Hard exclusion — real estate cannot be a financial asset
  if (hasImovelKeyword(u)) return false

  if (/\bCDB\b/.test(u)) return true
  if (u.includes('CONTA CORRENTE') || u.includes('CONTA POUPAN') || u.includes('CONTA INVEST')) return true
  if (/\bCRI\b/.test(u) || /\bCRA\b/.test(u)) return true
  if (/\bLCI\b/.test(u) || /\bLCA\b/.test(u)) return true
  if (u.includes('TESOURO SELIC') || u.includes('TESOURO IPCA') ||
      u.includes('TESOURO DIRETO') || u.includes('TESOURO PREFIXADO') ||
      u.includes('NTN-') || u.includes('LFT ') || u.includes('LTN ')) return true
  // FUNDO: allowed only after imovel exclusion — "FUNDO DE REPOSICAO" on a property is now blocked
  if (u.includes('FUNDO') || /\bFDO\b/.test(u) || /\bFIM\b/.test(u) || /\bFIA\b/.test(u)) return true
  if (u.includes('PREVIDENCIA') || u.includes('PREVIDÊNCIA') ||
      u.includes('PGBL') || u.includes('VGBL')) return true
  if (u.includes('APLICACAO') || u.includes('APLICAÇÃO') || u.includes('APLICACOES')) return true
  if (u.includes('BITCOIN') || u.includes('CRIPTO') || /\bBTC\b/.test(u)) return true
  if (u.includes('POUPANÇA') || u.includes('POUPANCA')) return true
  if (u.includes('DEBENTURE') || u.includes('DEBÊNTURE')) return true
  if (u.includes('RENDA FIXA') || u.includes('RENDA VARIAVEL') || u.includes('RENDA VARIÁVEL')) return true
  if (u.includes('INVESTIMENTO') || u.includes('CARTEIRA')) return true
  // Account balance / deposit descriptors — can't be real estate
  if (/\bSALDO\b/.test(u)) return true
  if (u.includes('DEPOSITO A PRAZO') || u.includes('DEPÓSITO A PRAZO')) return true
  if (u.includes('CERTIFICADO DE DEPOS')) return true  // CDB, RDB variants
  if (/\bRENDABILIDADE\b/.test(u)) return true
  if (u.includes('EXTRATO DE CONTA') || u.includes('EXTRATO BANCARIO') || u.includes('EXTRATO BANCÁRIO')) return true
  // If discriminação matches any known financial institution, it cannot be real estate
  if (INSTITUTION_PATTERNS.some(([pattern]) => pattern.test(discriminacao))) return true
  return false
}

function classify(bem: BemOuDireito): Category {
  const g = bem.grupo?.toString().padStart(2, '0')
  const c = bem.codigo?.toString().padStart(2, '0')
  const u = bem.discriminacao.toUpperCase()

  // ── Discriminação-first: catches PDF-extraction misclassifications ─────────
  // Must run before grupo check — Haiku can assign wrong grupo from PDF layout.
  if (isCreditoAReceber(bem.discriminacao)) return 'credito'
  if (isBolsaOrFII(bem.discriminacao)) return 'ativo_financeiro'
  if (isFinancialAsset(bem.discriminacao)) return 'ativo_financeiro'

  // ── Participação rescue ───────────────────────────────────────────────────
  // Runs after isFinancialAsset so FIPs (caught by FUNDO keyword) stay financial.
  // Catches items like "PARTICIPACAO NO CAPITAL SOCIAL DA EMPRESA X" that Haiku
  // may have assigned to grupo 04/05 instead of grupo 03.
  if (hasParticipacaoKeyword(u)) return 'participacao'

  // ── Real-estate rescue: catches Causa 2 (PDF grupo misassignment) ─────────
  // isFinancialAsset already returned false for these (imovel keywords present).
  // If grupo was wrongly extracted as 03/04/05/06 by Haiku, reclaim as imovel.
  if (hasImovelKeyword(u)) return 'imovel'

  if (IMOVEL_GRUPOS.has(g)) return 'imovel'

  if (g === '03') {
    // Codes that are always publicly traded / financial instruments — no exceptions
    if (c === '01' || c === '03' || c === '04' || c === '05') return 'ativo_financeiro'

    // For quotas (02) and outras (99): private equity ONLY if:
    //   1. CNPJ is present (listed companies don't have CNPJ in this IRPF field)
    //   2. discriminacao does NOT match any listed/fund/ticker pattern
    // If either condition fails, it goes to ativo_financeiro.
    if (c === '02' || c === '99') {
      if (!bem.cnpj) return 'ativo_financeiro'
      if (isBolsaOrFII(bem.discriminacao)) return 'ativo_financeiro'
      return 'participacao'
    }

    // Any other grupo 03 code defaults to ativo_financeiro
    return 'ativo_financeiro'
  }

  if (g === '04' || g === '05' || g === '06') return 'ativo_financeiro'

  // Grupo 07: Fundos de Investimento — always financial
  if (g === '07') return 'ativo_financeiro'

  // Grupo 08: Criptoativos — always financial
  if (g === '08') return 'ativo_financeiro'

  // Grupo 09: Trusts e estruturas no exterior — always financial
  if (g === '09') return 'ativo_financeiro'

  // Grupo 02 (veículos), 99 (outros) — skip for MVP
  return 'skip'
}

// ── Dedup for PDF-sourced items ───────────────────────────────────────────────
// PDF extraction of a 27-page IRPF produces ~100 bens — many are repeated
// across pages. Strategy: deduplicate by (grupo, codigo, valorAtual) exact match,
// keeping the entry with the longest discriminacao (most informative).

function deduplicatePDF(bens: BemOuDireito[]): BemOuDireito[] {
  const seen = new Map<string, BemOuDireito>()

  for (const bem of bens) {
    // A true duplicate is the SAME item appearing on multiple PDF pages:
    // identical grupo + codigo + identity + value (within R$1 rounding).
    // We must NOT merge distinct assets that happen to share an institution CNPJ
    // (e.g., three different BTG funds all tagged with BTG's CNPJ).
    //
    // Key strategy:
    //   - identity = CNPJ when present, else first 50 chars of discriminacao
    //   - value bucket = situacaoAtual rounded to nearest integer
    //   Two items with the same group/code/identity but DIFFERENT values are
    //   distinct assets and must both be kept.
    const identity = bem.cnpj
      ? bem.cnpj
      : bem.discriminacao.slice(0, 50).trim().toUpperCase()
    const valueBucket = Math.round(bem.situacaoAtual)
    const key = `${bem.grupo}|${bem.codigo}|${identity}|${valueBucket}`

    const existing = seen.get(key)
    if (!existing || bem.discriminacao.length > existing.discriminacao.length) {
      seen.set(key, bem)
    }
  }

  return Array.from(seen.values())
}

// ── Institution pattern detection ────────────────────────────────────────────
// Runs against discriminacao to pre-classify the custodian institution.
// Coverage: ~60-70% of a typical IRPF.
// Assets that don't match → instituicao: '' → appear in "A Classificar" bucket in the UI.

const INSTITUTION_PATTERNS: [RegExp, string][] = [
  // ── Brazilian banks ──────────────────────────────────────────────────────────
  [/\bITA[ÚU]\b|BANCO\s+ITA[ÚU]|\bITAU\b/i, 'Itaú'],
  [/\bBRADESCO\b/i, 'Bradesco'],
  [/\bBTG\b|BTG\s+PACTUAL/i, 'BTG Pactual'],
  [/\bSANTANDER\b/i, 'Santander'],
  [/\bCEF\b|CAIXA\s+ECON[Ô]MICA/i, 'Caixa Econômica Federal'],
  [/\bBANCO\s+DO\s+BRASIL\b|\bBB\s+DTVM\b/i, 'Banco do Brasil'],
  [/\bSAFRA\b/i, 'Banco Safra'],
  [/\bVOTO\s*RANTIN\b|\bVOTORANTIM\b/i, 'Votorantim'],
  [/\bDAYCOVAL\b/i, 'Daycoval'],
  [/\bPINE\s+BANK\b|\bBANCO\s+PINE\b/i, 'Banco Pine'],
  [/\bABC\s+BRASIL\b/i, 'ABC Brasil'],
  [/\bOURINVEST\b/i, 'Ourinvest'],
  [/\bBANCO\s+INTER\b|\bINTER\b(?=\s*[-–—])/i, 'Banco Inter'],
  [/\bC6\s+BANK\b|\bC6\b(?=\s*[-–—])/i, 'C6 Bank'],
  [/\bNUBANK\b|\bNU\s+BANK\b/i, 'Nubank'],
  [/\bSOFISA\b/i, 'Sofisa'],
  [/\bCITIBANK\b|\bCITI\b(?=\s*[-–—])/i, 'Citibank'],
  [/\bMODAL\b/i, 'Banco Modal'],
  [/\bSICAREDI\b/i, 'Sicredi'],
  [/\bSICOOB\b/i, 'Sicoob'],
  // ── Brazilian brokers / wealth managers ──────────────────────────────────────
  [/\bXP\b(?=\s+INVEST|\s+CORRE|\s+ADVISOR|\s+PRIVATE|\s+INC|\b)/i, 'XP Investimentos'],
  [/\bSINGULARE\b/i, 'Singulare'],
  [/\bGENIAL\b/i, 'Genial Investimentos'],
  [/\bRICO\s+INVES/i, 'Rico'],
  [/\bCLEAR\b(?=\s*[-–—]|\s+CORRE)/i, 'Clear Corretora'],
  [/\bWARREN\b/i, 'Warren'],
  [/\bNUINVEST\b|NU\s+INVEST/i, 'NuInvest'],
  [/\bGUIDE\s+INVEST/i, 'Guide Investimentos'],
  [/\bORAMA\b|ÓRAMA\b/i, 'Órama'],
  [/\bAVENUE\b/i, 'Avenue'],
  [/\bTORO\s+INVEST/i, 'Toro Investimentos'],
  [/\bVITREO\b/i, 'Vitreo'],
  [/\bKINEA\b/i, 'Kinea'],
  [/\bP[AÁ]TRIA\b/i, 'Pátria Investimentos'],
  [/\bMIRAE\b/i, 'Mirae Asset'],
  [/\bDAYTRADE\b|\bAGORA\b/i, 'Ágora Investimentos'],
  [/\bMILLENIUM\b/i, 'Millennium BCP'],
  [/\bPICPAY\b/i, 'PicPay'],
  [/\bMERCADO\s+PAGO\b/i, 'Mercado Pago'],
  // ── International banks / custodians ──────────────────────────────────────────
  [/\bJP\s*MORGAN\b|\bJPMORGAN\b/i, 'JP Morgan'],
  [/\bMORGAN\s+STANLEY\b/i, 'Morgan Stanley'],
  [/\bGOLDMAN\s+SACHS\b|\bGOLDMAN\b/i, 'Goldman Sachs'],
  [/\bUBS\b/i, 'UBS'],
  [/\bJULIUS\s+BA[EÄ]R\b|\bJULIUS\b/i, 'Julius Baer'],
  [/\bCREDIT\s+SUISSE\b/i, 'Credit Suisse'],
  [/\bDEUTSCHE\s+BANK\b/i, 'Deutsche Bank'],
  [/\bHSBC\b/i, 'HSBC'],
  [/\bBNP\s+PARIBAS\b|\bBNP\b/i, 'BNP Paribas'],
  [/\bCREDIT\s+AGRICOLE\b/i, 'Crédit Agricole'],
  [/\bSCOTIABANK\b/i, 'Scotiabank'],
  [/\bDREYFUS\b/i, 'Dreyfus'],
  // ── Tesouro ───────────────────────────────────────────────────────────────────
  [/\bTESO\s*URO\s+NACION|\bTESO\s*URO\s+DIRETO/i, 'Tesouro Nacional'],
  // ── Empiricus ─────────────────────────────────────────────────────────────────
  [/\bEMPIRICUS\b/i, 'Empiricus'],
]

function detectInstituicao(discriminacao: string): string {
  for (const [pattern, name] of INSTITUTION_PATTERNS) {
    if (pattern.test(discriminacao)) return name
  }
  // No fallback — returning a raw discriminacao fragment produces false institution cards
  // (e.g. "APLICACAO EM CRA", "UMA CASA SITUADA NA PRAIA DO UNA", "CONTA CORRENTE 6JZ").
  // Unknown custodians are left blank; the advisor fills them in manually.
  return ''
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildImovel(bem: BemOuDireito): ImovelRecord {
  const needsReview = bem.source === 'pdf' || bem.situacaoAtual === 0
  return {
    descricao: bem.discriminacao,
    endereco: bem.localizacao,
    valorDeclarado: bem.situacaoAtual,
    source: bem.source,
    needsReview,
    observacoes: bem.paisLocalizacao ? `País: ${bem.paisLocalizacao}` : undefined,
  }
}

function buildAtivoFinanceiro(bem: BemOuDireito): AtivoFinanceiro {
  const instituicao = detectInstituicao(bem.discriminacao)
  const tipo = inferTipoAtivo(bem)
  const needsReview = bem.source === 'pdf' || !bem.cnpj || instituicao === ''

  return {
    instituicao,
    tipo,
    cnpj: bem.cnpj,
    valorAproximado: bem.situacaoAtual,
    descricao: bem.discriminacao,
    source: bem.source,
    needsReview,
  }
}

function buildParticipacao(bem: BemOuDireito): ParticipacaoSocietaria {
  const empresa = extractEmpresaName(bem.discriminacao)
  const percentual = extractPercentual(bem.discriminacao)
  const needsReview = bem.source === 'pdf' || percentual === 0

  return {
    empresa,
    cnpj: bem.cnpj ?? '',
    percentual,
    valorPatrimonial: bem.situacaoAtual > 0 ? bem.situacaoAtual : undefined,
    source: bem.source,
    needsReview,
  }
}

function buildCreditoFromBem(bem: BemOuDireito): CreditoRecord {
  // "EMPRESA XPTO - CREDITO DE DIVIDENDOS A RECEBER - US$ 103,733.87 (TX 6,1917)"
  const parts = bem.discriminacao.split(/\s*[-–—]\s*/u)
  const devedor = parts[0]?.trim() || bem.discriminacao.slice(0, 60)

  return {
    devedor,
    tipoPessoa: 'PJ',
    cnpjCpf: bem.cnpj,
    valorPrincipal: bem.situacaoAtual,
    tipoInstrumento: 'Crédito de Dividendos / Proventos',
    statusCredito: 'ativo',
    observacoes: bem.discriminacao,
    source: bem.source ?? 'manual',
    needsReview: true,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferTipoAtivo(bem: BemOuDireito): string {
  const g = bem.grupo?.toString().padStart(2, '0')
  const c = bem.codigo?.toString().padStart(2, '0')
  const disc = bem.discriminacao.toUpperCase()

  // ── DISCRIMINAÇÃO-FIRST: specific product keywords override grupo/codigo ───
  // This ensures "APLICACAO EM CRA" is never classified as "Título Público".

  // CDB must come before grupo 04 c=03 (Título Público) fallback
  if (/\bCDB\b/.test(disc)) return 'CDB'

  // CRA/CRI — regardless of codigo
  if (/\bCRA\b/.test(disc)) return 'Debênture / CRI / CRA'
  if (/\bCRI\b/.test(disc)) return 'Debênture / CRI / CRA'

  // LCI/LCA — frequently show up under grupo 04 c=03
  if (/\bLCI\b/.test(disc)) return 'LCI / LCA'
  if (/\bLCA\b/.test(disc)) return 'LCI / LCA'

  // Debenture
  if (/\bDEB[EÊ]NTURE/.test(disc)) return 'Debênture / CRI / CRA'

  // Tesouro Direto / Títulos Públicos — explicit name in discriminacao
  if (disc.includes('TESOURO SELIC') || disc.includes('TESOURO IPCA') ||
      disc.includes('TESOURO PREFIXADO') || disc.includes('TESOURO DIRETO') ||
      disc.includes('NTN-') || disc.includes('LFT ') || disc.includes('LTN ')) {
    return 'Título Público / Tesouro Direto'
  }

  // Previdência — keywords appear in discriminacao too
  if (disc.includes('PGBL') || disc.includes('VGBL') || disc.includes('PREVIDÊNCIA') ||
      disc.includes('PREVIDENCIA')) {
    return 'Previdência Privada (PGBL)'
  }

  // Crypto
  if (disc.includes('BITCOIN') || disc.includes('ETHEREUM') || disc.includes('CRIPTO') ||
      disc.includes('TOKEN') || /\bBTC\b/.test(disc) || /\bETH\b/.test(disc)) {
    return 'Criptoativo'
  }

  // Poupança
  if (disc.includes('POUPANÇA') || disc.includes('POUPANCA')) return 'Conta Poupança'

  // ── GRUPO/CODIGO FALLBACK (high-confidence, no ambiguous codes) ───────────
  if (g === '04') {
    if (c === '01') return 'Conta Corrente / Poupança'
    if (c === '02') return 'Debênture / CRI / CRA'
    // c=03 (Título Público) only if no CRA/CRI/LCI/LCA caught above
    if (c === '03') return 'Título Público / Tesouro Direto'
    if (c === '04') return 'Previdência Privada (PGBL)'
    if (c === '05') return 'Fundo de Investimento'
    if (c === '06') return 'FGTS'
    if (c === '07') return 'Fundo de Ações'
    if (c === '08') return 'Criptoativo'
    if (c === '09') return 'Consórcio'
  }
  if (g === '03') {
    if (c === '01') return 'Ações (Bolsa de Valores)'
    if (c === '03' || c === '04' || c === '05') return 'Fundo / Instrumento Financeiro'
  }
  if (g === '05' || g === '06') return 'Crédito / Direito'

  // Grupo 07: Fundos de Investimento
  if (g === '07') {
    if (c === '02') return 'Fundo de Investimento Imobiliário (FII)'
    if (c === '03') return 'Previdência Privada (PGBL)'
    if (c === '04') return 'Fundo de Participações (FIP)'
    return 'Fundo de Investimento'
  }

  // Grupo 08: Criptoativos
  if (g === '08') return 'Criptoativo'

  // Grupo 09: Trusts / estruturas no exterior
  if (g === '09') return 'Trust / Estrutura no Exterior'

  // ── DISCRIMINAÇÃO FALLBACK for remaining cases ────────────────────────────
  if (disc.includes('FUNDO') || /\bFDO\b/.test(disc) || /\bFI\b/.test(disc)) return 'Fundo de Investimento'
  if (disc.includes('TESOURO')) return 'Título Público / Tesouro Direto'
  if (disc.includes('CONTA CORRENTE') || disc.includes('CC ') || disc.includes(' CC')) return 'Conta Corrente / Poupança'

  return 'Aplicação Financeira'
}

// Portuguese articles/prepositions kept lowercase in Title Case conversion
const PT_LOWERCASE = new Set([
  'de','da','do','das','dos','e','em','na','no','nas','nos',
  'a','o','as','os','ao','aos','à','às','com','por','para','que','se',
])

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      // Always capitalise first word, acronyms (≤4 chars all-upper), and proper suffixes
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1)
      if (PT_LOWERCASE.has(word)) return word
      // Preserve well-known legal suffixes in standard casing
      const upper = word.toUpperCase()
      if (['LTDA','S.A.','S/A','SA','EIRELI','ME','EPP','SS','SAS','SC'].includes(upper)) return upper
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function extractEmpresaName(discriminacao: string): string {
  let text = discriminacao
    .replace(/CNPJ[\s:]*[\d.\/-]+/gi, '')             // remove inline "CNPJ XX.XXX..."
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '') // remove bare CNPJ pattern
    .replace(/\d+[,.]?\d*\s*%.*$/i, '')               // remove "15%..." and everything after
    .replace(/\([\w\s,.]+?\)/g, '')                    // remove parenthesised clauses e.g. "(UM MILHÃO)"
    .replace(/\s+/g, ' ')
    .trim()

  // Strip leading "N (EXTENSO) QUOTAS/AÇÕES DE" patterns: "1000000 QUOTAS DO CAPITAL SOCIAL DA"
  text = text
    .replace(/^\d[\d.,]*\s+(?:QUOT[AO]S?|COTAS?|A[CÇ][OÕ]ES?)\s+(?:DO\s+CAPITAL\s+SOCIAL\s+)?(?:DA|DE|DO|EM|NA|NO)\s+/i, '')
    .trim()

  // Strip common IRPF structural prefixes before the company name (order: longest first)
  const prefixes: RegExp[] = [
    /^PARTICIPA[CÇ][AÃ]O\s+SOCIET[AÁ]RIA\s+(?:EM|NA|NO|DE|DA|DO)\s+/i,
    /^PARTICIPA[CÇ][AÃ]O\s+(?:EM|NA|NO|DE|DA|DO)\s+/i,
    /^PARTICIPA[CÇ][OÕ]ES?\s+(?:EM|NA|NO|DE|DA|DO)\s+/i,
    /^QUOT[AO]S?\s+DO\s+CAPITAL\s+SOCIAL\s+(?:DA|DE|DO|EM)\s+/i,
    /^QUOT[AO]S?\s+(?:SOCIAIS?\s+)?(?:EM|NA|NO|DE|DA|DO)\s+/i,
    /^COTAS?\s+(?:DO\s+CAPITAL\s+SOCIAL\s+)?(?:DE|EM|NA|NO|DA|DO)\s+/i,
    /^A[CÇ][OÕ]ES?\s+(?:ORDIN[AÁ]RIAS?\s+|PREFERENCI[AÁ]IS?\s+)?(?:DE|EM|NA|NO|DA|DO)\s+/i,
    /^INVESTIMENTO\s+(?:EM|NA|NO|DE)\s+/i,
    /^S[OÓ]CIO\s+(?:QUOTISTA\s+)?(?:DA|DE|DO)\s+/i,
    /^CAPITAL\s+SOCIAL\s+(?:DA|DE|DO)\s+/i,
  ]
  for (const re of prefixes) {
    const stripped = text.replace(re, '').trim()
    if (stripped.length > 0) { text = stripped; break }
  }

  // Take the first meaningful segment (before a dash, which separates name from description)
  const parts = text.split(/\s*[-–—]\s*/u)
  const raw = parts[0]?.trim() ?? discriminacao

  // Convert to Title Case for readability; truncate if still too long
  const name = toTitleCase(raw)
  return name.length > 80 ? name.slice(0, 77) + '…' : name
}

function extractPercentual(discriminacao: string): number {
  // Match patterns like "15%", "15,5%", "15.5%", "15 por cento"
  const match = discriminacao.match(/(\d{1,3}[.,]?\d*)\s*%/)
  if (match) {
    return parseFloat(match[1].replace(',', '.'))
  }
  return 0
}

// ── ReviewFlag generators ─────────────────────────────────────────────────────

function buildReviewFlags(
  imoveis: ImovelRecord[],
  ativos: AtivoFinanceiro[],
  participacoes: ParticipacaoSocietaria[],
  sourceFormat: 'dec' | 'pdf',
): ReviewFlag[] {
  const flags: ReviewFlag[] = []

  if (sourceFormat === 'pdf') {
    flags.push({
      section: 'geral',
      field: 'sourceFormat',
      message: 'Dados extraídos via PDF — revisão obrigatória. Verifique valores e itens duplicados.',
      severity: 'warning',
    })
  }

  imoveis.forEach((im, i) => {
    if (im.valorDeclarado === 0) {
      flags.push({
        section: 'imoveis',
        field: `imoveis[${i}].valorDeclarado`,
        message: `Imóvel sem valor declarado: "${im.descricao.slice(0, 50)}"`,
        severity: 'warning',
      })
    }
    if (!im.endereco) {
      flags.push({
        section: 'imoveis',
        field: `imoveis[${i}].endereco`,
        message: `Imóvel sem endereço identificado: "${im.descricao.slice(0, 50)}"`,
        severity: 'info',
      })
    }
    if (im.needsReview && sourceFormat === 'pdf') {
      flags.push({
        section: 'imoveis',
        field: `imoveis[${i}]`,
        message: `Imóvel extraído via PDF — confirme dados com escritura ou IPTU.`,
        severity: 'info',
      })
    }
  })

  ativos.forEach((at, i) => {
    if (at.valorAproximado === 0) {
      flags.push({
        section: 'ativosFinanceiros',
        field: `ativosFinanceiros[${i}].valorAproximado`,
        message: `Ativo sem valor: "${at.instituicao}"`,
        severity: 'info',
      })
    }
    if (!at.cnpj) {
      flags.push({
        section: 'ativosFinanceiros',
        field: `ativosFinanceiros[${i}].cnpj`,
        message: `CNPJ não identificado para: "${at.instituicao}"`,
        severity: 'info',
      })
    }
  })

  participacoes.forEach((p, i) => {
    if (!p.cnpj) {
      flags.push({
        section: 'participacoesSocietarias',
        field: `participacoesSocietarias[${i}].cnpj`,
        message: `CNPJ ausente para participação em: "${p.empresa}"`,
        severity: 'required',
      })
    }
    if (p.percentual === 0) {
      flags.push({
        section: 'participacoesSocietarias',
        field: `participacoesSocietarias[${i}].percentual`,
        message: `Percentual de participação não identificado: "${p.empresa}"`,
        severity: 'required',
      })
    }
  })

  return flags
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generatePlaybook(
  irpf: IRPFData,
  clientId: string,
  advisorId: string,
): PlaybookData {
  const now = new Date()

  // Dedup PDF items before classifying
  const rawBens = irpf.sourceFormat === 'pdf'
    ? deduplicatePDF(irpf.bensEDireitos)
    : irpf.bensEDireitos

  const imoveis: ImovelRecord[] = []
  const ativosFinanceiros: AtivoFinanceiro[] = []
  const participacoesSocietarias: ParticipacaoSocietaria[] = []
  const creditosGerados: CreditoRecord[] = []
  // Grupo 02 (veículos) + 99 (outros) → born directly in outrosBensEDireitos.
  // Advisor can reclassify individual items to other sections via the UI.
  const outrosBensEDireitosGerados: OutroBemEDireitoRecord[] = []

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format
  const categoryLog: Record<string, number> = {}

  for (const bem of rawBens) {
    const cat = classify(bem)
    const val = typeof bem.situacaoAtual === 'number' ? bem.situacaoAtual : 0

    // Log every item so we can trace the gap
    console.log(`[generator] g${bem.grupo}c${bem.codigo} → ${cat} | ${fmt(val)} | ${bem.discriminacao.slice(0, 60)}`)

    // Only include items with value > 0 (situacaoAtual is the year-end balance)
    if (val <= 0 && cat !== 'imovel') {
      console.log(`[generator] SKIPPED (zero value, non-imóvel): ${bem.discriminacao.slice(0, 60)}`)
      continue
    }

    categoryLog[cat] = (categoryLog[cat] ?? 0) + val

    switch (cat) {
      case 'imovel':
        imoveis.push(buildImovel(bem))
        break
      case 'ativo_financeiro':
        ativosFinanceiros.push(buildAtivoFinanceiro(bem))
        break
      case 'participacao':
        participacoesSocietarias.push(buildParticipacao(bem))
        break
      case 'credito':
        creditosGerados.push(buildCreditoFromBem(bem))
        break
      case 'skip':
        if (val > 0) {
          outrosBensEDireitosGerados.push({
            descricao: bem.discriminacao,
            grupo: bem.grupo,
            codigo: bem.codigo,
            valor: bem.situacaoAtual,
            source: bem.source,
            needsReview: bem.source === 'pdf',
          })
        }
        break
    }
  }

  const totalClassified = Object.values(categoryLog).reduce((s, v) => s + v, 0)
  const declared = irpf.totalBensEDireitosDeclarado ?? 0
  console.log('[generator] Category totals:', Object.entries(categoryLog).map(([k,v]) => `${k}: ${fmt(v)}`).join(' | '))
  console.log(`[generator] Classified total: ${fmt(totalClassified)} | Declared: ${fmt(declared)} | Gap: ${fmt(Math.abs(totalClassified - declared))}`)

  // Sort imoveis: value descending
  imoveis.sort((a, b) => b.valorDeclarado - a.valorDeclarado)
  // Sort ativos: value descending (relevância / tamanho conforme IRPF)
  ativosFinanceiros.sort((a, b) => b.valorAproximado - a.valorAproximado)
  // Sort participações: value descending
  participacoesSocietarias.sort((a, b) => (b.valorPatrimonial ?? 0) - (a.valorPatrimonial ?? 0))

  const reviewFlags = buildReviewFlags(
    imoveis,
    ativosFinanceiros,
    participacoesSocietarias,
    irpf.sourceFormat,
  )

  // Build dadosPessoais
  const d = irpf.dadosDeclarante
  const enderecoPartes = [d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep]
    .filter(Boolean).join(', ')

  const contatos: { tipo: string; valor: string }[] = []
  if (d.telefone) contatos.push({ tipo: 'Telefone', valor: d.telefone })
  if (d.email) contatos.push({ tipo: 'Email', valor: d.email })

  const familiares = irpf.dependentes.map(dep => ({
    nome: dep.nome,
    relacao: dep.relacao,
    cpf: dep.cpf,
  }))

  return {
    clientId,
    advisorId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,

    dadosPessoais: {
      nome: d.nome,
      cpf: d.cpf,
      dataNascimento: d.dataNascimento,
      endereco: enderecoPartes || undefined,
      email: d.email || undefined,
      telefone: d.telefone || undefined,
      contatos,
      familiares,
    },

    imoveis,
    ativosFinanceiros,
    participacoesSocietarias,
    creditos: creditosGerados.length > 0 ? creditosGerados : undefined,

    irpfYearsLoaded: [irpf.anoCalendario],
    reviewFlags,

    totalIRPFDeclarado: irpf.totalBensEDireitosDeclarado,
    outrosBensEDireitos: outrosBensEDireitosGerados.length > 0 ? outrosBensEDireitosGerados : undefined,
    instituicoesFinanceiras: deriveInstituicoes(ativosFinanceiros),
  }
}

// Patterns that indicate a fund/product name rather than a custodian institution.
// Exclude from auto-derivation to avoid polluting the dropdown with strings like
// "FUNDO DE ACOES XYZ" or "FIC FIM MASTER" that come from raw IRPF ativo fields.
// Strings that are fund/product descriptions rather than custodian institution names.
// - starts with a digit: stock position descriptions like "900 AÇÕES JBSS3", "146 AÇÕES SEQL3"
// - fund/vehicle prefixes: FUNDO, FI, FIA, FIC, FIM, FIDC, FII, ETF…
// - product types: PREVIDENCIA, PGBL, VGBL, CONSORCIO
// - contains "AÇÕES" anywhere: stock quantity descriptions
const FUND_NAME_RE = /^(FUNDO|FI\s|FIA\s|FIC\s|FIM\s|FIDC\s|FII\s|ETF\s|PREVIDENCIA|PGBL|VGBL|CONSORCIO|\d)/i
const ACOES_RE = /\bAÇÕES\b/i

function deriveInstituicoes(ativos: AtivoFinanceiro[]): InstituicaoFinanceira[] | undefined {
  const names = Array.from(
    new Set(
      ativos
        .map(a => a.instituicao)
        .filter((n): n is string =>
          !!n &&
          n.trim().length > 0 &&
          n.trim().length <= 60 &&        // fund names tend to be longer
          !FUND_NAME_RE.test(n.trim()) && // exclude fund/product/position strings
          !ACOES_RE.test(n.trim())        // exclude stock position descriptions
        )
    )
  )
  return names.length > 0 ? names.map(nome => ({ nome })) : undefined
}

// ── Advisor classification helpers ────────────────────────────────────────────

/**
 * Dedup key for OutroBemItem — mirrors the key used in deduplicatePDF so that
 * advisor classifications survive regeneration even after re-extraction.
 */
export function outrosBemKey(item: OutroBemItem): string {
  const identity = item.cnpj
    ? item.cnpj
    : item.discriminacao.slice(0, 50).trim().toUpperCase()
  return `${item.grupo}|${item.codigo}|${identity}|${Math.round(item.situacaoAtual)}`
}

/**
 * Applies advisor classifications from outrosBens to playbook sections.
 * Items with classificacaoAdvisor === 'outro_bem' → outrosBensEDireitos.
 * Items reclassified to other categories → their respective section arrays.
 * Items with 'skip' or no classification remain in outrosBens (residual).
 * outrosBensValor is rebuilt from the residual.
 *
 * Call this in the regenerate merge step after carrying over advisor fields.
 */
export function applyAdvisorClassifications(playbook: PlaybookData): PlaybookData {
  const items = playbook.outrosBens ?? []
  if (items.every(i => !i.classificacaoAdvisor || i.classificacaoAdvisor === 'skip')) {
    return playbook
  }

  const remainingOutros: OutroBemItem[] = []
  const newImoveis = [...playbook.imoveis]
  const newAtivos = [...playbook.ativosFinanceiros]
  const newParticipacoes = [...playbook.participacoesSocietarias]
  const newCreditos = [...(playbook.creditos ?? [])]
  const newOutrosBensEDireitos = [...(playbook.outrosBensEDireitos ?? [])]

  for (const item of items) {
    const cat = item.classificacaoAdvisor
    if (!cat || cat === 'skip') {
      remainingOutros.push(item)
      continue
    }

    // Convert OutroBemItem → BemOuDireito for the section builders
    const bem: BemOuDireito = {
      grupo: item.grupo,
      codigo: item.codigo,
      discriminacao: item.discriminacao,
      situacaoAtual: item.situacaoAtual,
      situacaoAnterior: 0,
      cnpj: item.cnpj,
      localizacao: item.localizacao,
      paisLocalizacao: item.paisLocalizacao,
      source: item.source,
    }

    switch (cat) {
      case 'outro_bem':
        newOutrosBensEDireitos.push({
          descricao: item.discriminacao,
          grupo: item.grupo,
          codigo: item.codigo,
          valor: item.situacaoAtual,
          source: item.source,
          needsReview: item.source === 'pdf',
          nota: item.notaAdvisor,
        })
        break
      case 'ativo_financeiro':
        newAtivos.push(buildAtivoFinanceiro(bem))
        break
      case 'imovel':
        newImoveis.push(buildImovel(bem))
        break
      case 'participacao':
        newParticipacoes.push(buildParticipacao(bem))
        break
      case 'credito':
        newCreditos.push(buildCreditoFromBem(bem))
        break
    }
  }

  const residualValor = remainingOutros.reduce((s, i) => s + i.situacaoAtual, 0)

  return {
    ...playbook,
    imoveis: newImoveis,
    ativosFinanceiros: newAtivos,
    participacoesSocietarias: newParticipacoes,
    creditos: newCreditos.length > 0 ? newCreditos : undefined,
    outrosBens: remainingOutros.length > 0 ? remainingOutros : undefined,
    outrosBensEDireitos: newOutrosBensEDireitos.length > 0 ? newOutrosBensEDireitos : undefined,
    outrosBensValor: residualValor > 0 ? residualValor : undefined,
  }
}

/**
 * Dedup key for OutroBemEDireitoRecord — used in regenerate merge to avoid
 * adding the same IRPF item twice after a re-run.
 */
export function outrosBemEDireitoKey(item: OutroBemEDireitoRecord): string {
  return `${item.grupo}|${item.codigo}|${item.descricao.slice(0, 50).trim().toUpperCase()}|${Math.round(item.valor)}`
}

/**
 * Applies advisor reclassifications from outrosBensEDireitos.
 * Items where classificacaoAdvisor !== 'outro_bem' are moved to their target section.
 * Items without classificacaoAdvisor or with 'outro_bem' remain in outrosBensEDireitos.
 * Call this in the regenerate merge step.
 */
export function applyOutrosBensReclassifications(playbook: PlaybookData): PlaybookData {
  const items = playbook.outrosBensEDireitos ?? []
  const toMove = items.filter(i => i.classificacaoAdvisor && i.classificacaoAdvisor !== 'outro_bem')

  if (toMove.length === 0) return playbook

  const remaining = items.filter(i => !i.classificacaoAdvisor || i.classificacaoAdvisor === 'outro_bem')
  const newImoveis = [...playbook.imoveis]
  const newAtivos = [...playbook.ativosFinanceiros]
  const newParticipacoes = [...playbook.participacoesSocietarias]
  const newCreditos = [...(playbook.creditos ?? [])]

  for (const item of toMove) {
    const bem: BemOuDireito = {
      grupo: item.grupo,
      codigo: item.codigo,
      discriminacao: item.descricao,
      situacaoAtual: item.valor,
      situacaoAnterior: 0,
      source: item.source,
    }

    switch (item.classificacaoAdvisor) {
      case 'ativo_financeiro':
        newAtivos.push(buildAtivoFinanceiro(bem))
        break
      case 'imovel':
        newImoveis.push(buildImovel(bem))
        break
      case 'participacao':
        newParticipacoes.push(buildParticipacao(bem))
        break
      case 'credito':
        newCreditos.push(buildCreditoFromBem(bem))
        break
    }
  }

  return {
    ...playbook,
    imoveis: newImoveis,
    ativosFinanceiros: newAtivos,
    participacoesSocietarias: newParticipacoes,
    creditos: newCreditos.length > 0 ? newCreditos : undefined,
    outrosBensEDireitos: remaining.length > 0 ? remaining : undefined,
  }
}
