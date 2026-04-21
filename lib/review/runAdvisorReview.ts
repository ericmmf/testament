import { PlaybookData, AdvisorReviewItem, AdvisorReviewStatus } from '@/lib/types/playbook'

// ── Gold Standard manual checklist ───────────────────────────────────────────
// 12 items across 3 categories. Status starts as 'pendente' unless carried over.

export const MANUAL_CHECKLIST: Omit<AdvisorReviewItem, 'status' | 'nota'>[] = [
  // Completude
  {
    id: 'comp_01',
    categoria: 'completude',
    descricao: 'Testamento ou declaração de intenções de partilha documentada',
  },
  {
    id: 'comp_02',
    categoria: 'completude',
    descricao: 'Todos os imóveis com matrícula e cartório identificados',
  },
  {
    id: 'comp_03',
    categoria: 'completude',
    descricao: 'Contratos sociais / estatutos de todas as participações societárias anexados',
  },
  {
    id: 'comp_04',
    categoria: 'completude',
    descricao: 'Beneficiários designados para todos os ativos financeiros (seguros, previdência)',
  },
  {
    id: 'comp_05',
    categoria: 'completude',
    descricao: 'Procurações vigentes identificadas e arquivadas',
  },
  // Consistência
  {
    id: 'cons_01',
    categoria: 'consistencia',
    descricao: 'Valor total de patrimônio consistente com última declaração de IRPF',
  },
  {
    id: 'cons_02',
    categoria: 'consistencia',
    descricao: 'Percentuais de participação societária somam corretamente (≤ 100% por empresa)',
  },
  {
    id: 'cons_03',
    categoria: 'consistencia',
    descricao: 'Regime de bens do casamento refletido corretamente no planejamento',
  },
  {
    id: 'cons_04',
    categoria: 'consistencia',
    descricao: 'Créditos ativos com garantias documentadas e vencimentos identificados',
  },
  // Qualidade
  {
    id: 'qual_01',
    categoria: 'qualidade',
    descricao: 'Briefing de intenções de partilha revisado e aprovado pelo cliente',
  },
  {
    id: 'qual_02',
    categoria: 'qualidade',
    descricao: 'Contatos essenciais (advogado, contador, gestor) completos e atuais',
  },
  {
    id: 'qual_03',
    categoria: 'qualidade',
    descricao: 'Nenhuma flag de revisão pendente na extração automatizada do IRPF',
  },
]

// ── Auto-validation checks ────────────────────────────────────────────────────

function autoItems(data: PlaybookData): AdvisorReviewItem[] {
  const items: AdvisorReviewItem[] = []

  // 1. Duplicate CNPJ in participações
  const cnpjs = data.participacoesSocietarias.map(p => p.cnpj).filter(Boolean)
  const seenCnpjs = new Set<string>()
  const dupCnpjs = new Set<string>()
  for (const c of cnpjs) {
    if (seenCnpjs.has(c)) dupCnpjs.add(c)
    seenCnpjs.add(c)
  }
  if (dupCnpjs.size > 0) {
    items.push({
      id: 'auto_dup_cnpj',
      categoria: 'consistencia',
      descricao: 'CNPJs duplicados em participações societárias',
      status: 'pendente',
      autoDetalhe: `CNPJs repetidos: ${[...dupCnpjs].join(', ')}`,
    })
  }

  // 2. Duplicate imóvel matricula
  const matriculas = data.imoveis.map(im => im.matricula).filter(Boolean) as string[]
  const seenMat = new Set<string>()
  const dupMat = new Set<string>()
  for (const m of matriculas) {
    if (seenMat.has(m)) dupMat.add(m)
    seenMat.add(m)
  }
  if (dupMat.size > 0) {
    items.push({
      id: 'auto_dup_matricula',
      categoria: 'consistencia',
      descricao: 'Matrículas de imóveis duplicadas',
      status: 'pendente',
      autoDetalhe: `Matrículas repetidas: ${[...dupMat].join(', ')}`,
    })
  }

  // 3. Imóveis sem matrícula
  const semMatricula = data.imoveis.filter(im => !im.matricula)
  if (semMatricula.length > 0) {
    items.push({
      id: 'auto_imovel_sem_matricula',
      categoria: 'completude',
      descricao: 'Imóveis sem número de matrícula informado',
      status: 'pendente',
      autoDetalhe: `${semMatricula.length} imóvel(is): ${semMatricula.map(im => im.descricao || 'sem descrição').join(', ')}`,
    })
  }

  // 4. Participações sem contrato social (sem anexo)
  const semContrato = data.participacoesSocietarias.filter(
    p => !(p.anexos ?? []).some(a => a.status === 'enviado')
  )
  if (semContrato.length > 0) {
    items.push({
      id: 'auto_part_sem_contrato',
      categoria: 'completude',
      descricao: 'Participações societárias sem contrato social/estatuto anexado',
      status: 'pendente',
      autoDetalhe: `${semContrato.length} empresa(s): ${semContrato.map(p => p.empresa || 'sem nome').join(', ')}`,
    })
  }

  // 5. Ativos financeiros com needsReview = true
  const ativosComFlag = data.ativosFinanceiros.filter(a => a.needsReview)
  if (ativosComFlag.length > 0) {
    items.push({
      id: 'auto_ativos_review',
      categoria: 'consistencia',
      descricao: 'Ativos financeiros com flag de revisão pendente',
      status: 'pendente',
      autoDetalhe: `${ativosComFlag.length} ativo(s): ${ativosComFlag.map(a => a.instituicao).join(', ')}`,
    })
  }

  // 6. Imóveis com deed check divergência
  const deedDiv = data.imoveis.filter(im => im.deedCheck?.status === 'divergencia')
  if (deedDiv.length > 0) {
    items.push({
      id: 'auto_deed_divergencia',
      categoria: 'consistencia',
      descricao: 'Imóveis com divergência entre dados do IRPF e matrícula registrada',
      status: 'pendente',
      autoDetalhe: `${deedDiv.length} imóvel(is): ${deedDiv.map(im => im.descricao).join(', ')}`,
    })
  }

  // 7. Créditos ativos sem data de vencimento
  const creditosSemVenc = (data.creditos ?? []).filter(
    c => c.statusCredito !== 'quitado' && !c.dataVencimento
  )
  if (creditosSemVenc.length > 0) {
    items.push({
      id: 'auto_credito_sem_venc',
      categoria: 'completude',
      descricao: 'Créditos ativos sem data de vencimento informada',
      status: 'pendente',
      autoDetalhe: `${creditosSemVenc.length} crédito(s): ${creditosSemVenc.map(c => c.devedor).join(', ')}`,
    })
  }

  // 8. Missing CPF on familiares
  const familiaresSemssCPF = data.dadosPessoais.familiares.filter(f => !f.cpf)
  if (familiaresSemssCPF.length > 0) {
    items.push({
      id: 'auto_familiar_sem_cpf',
      categoria: 'completude',
      descricao: 'Dependentes sem CPF informado',
      status: 'pendente',
      autoDetalhe: `${familiaresSemssCPF.length} dependente(s): ${familiaresSemssCPF.map(f => f.nome).join(', ')}`,
    })
  }

  // 9. Review flags count
  const openFlags = data.reviewFlags.filter(f => f.severity !== 'info')
  if (openFlags.length > 0) {
    items.push({
      id: 'auto_open_flags',
      categoria: 'qualidade',
      descricao: 'Flags de revisão do IRPF não resolvidas',
      status: 'pendente',
      autoDetalhe: `${openFlags.length} flag(s) aberta(s)`,
    })
  }

  return items
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Merges auto-generated checks with existing manual review state.
 * Auto items are regenerated fresh each time.
 * Manual items carry over their status/nota from prior state.
 */
export function runAdvisorReview(
  data: PlaybookData,
  existing: AdvisorReviewItem[] = []
): AdvisorReviewItem[] {
  const existingMap = new Map(existing.map(i => [i.id, i]))

  // Rebuild manual checklist preserving prior status
  const manual: AdvisorReviewItem[] = MANUAL_CHECKLIST.map(template => {
    const prior = existingMap.get(template.id)
    return {
      ...template,
      status: (prior?.status ?? 'pendente') as AdvisorReviewStatus,
      nota: prior?.nota,
    }
  })

  // Auto items: regenerate, but preserve status if advisor already marked them
  const auto = autoItems(data).map(item => {
    const prior = existingMap.get(item.id)
    return {
      ...item,
      status: (prior?.status ?? 'pendente') as AdvisorReviewStatus,
      nota: prior?.nota,
    }
  })

  // Auto items first (issues to resolve), then manual checklist
  return [...auto, ...manual]
}
