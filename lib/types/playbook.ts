// Manual Patrimonial data model

// ── Generic attachment (reused across Imóvel, Participação, Ativos) ───────────

export interface RecordAnexo {
  nome: string
  fileName?: string
  storagePath?: string
  uploadedAt?: string
  status: 'pendente' | 'enviado'
}

// ── Deed Check (matrícula cross-reference) ────────────────────────────────────

export type DeedCheckStatus = 'nao_verificado' | 'ok' | 'divergencia' | 'parcial'

export interface DeedCheckFlag {
  campo: string
  irpf: string
  matricula: string
  severidade: 'warning' | 'required'
}

export interface DeedCheckData {
  status: DeedCheckStatus
  verificadoEm?: string
  // Dados extraídos da matrícula via AI
  numeroMatricula?: string
  proprietarioRegistrado?: string
  areaRegistrada?: string
  valorAquisicaoRegistrado?: number
  dataAquisicao?: string
  onus?: string             // hipoteca, penhora, usufruto, etc.
  cartorioRegistrado?: string
  // Resultado da comparação
  flags?: DeedCheckFlag[]
  rawExtraction?: string    // JSON string com todos os campos extraídos pelo modelo
}

// ── Imóvel ────────────────────────────────────────────────────────────────────

export interface ImovelRecord {
  descricao: string;
  matricula?: string;
  cartorio?: string;
  endereco?: string;
  areaTotal?: string;
  valorDeclarado: number;
  percentualPropriedade?: number;
  observacoes?: string;
  source: 'dec' | 'pdf' | 'manual';
  needsReview: boolean;
  anexos?: RecordAnexo[];
  deedCheck?: DeedCheckData;
}

// ── Ativos Financeiros ────────────────────────────────────────────────────────

export interface AtivoFinanceiro {
  instituicao: string;
  tipo: string;
  cnpj?: string;
  valorAproximado: number;
  descricao?: string;
  source: 'dec' | 'pdf' | 'manual';
  needsReview: boolean;
}

// ── Participação Societária ───────────────────────────────────────────────────

export interface ParticipacaoSocietaria {
  empresa: string;
  cnpj: string;
  percentual: number;
  naturezaJuridica?: string;
  valorPatrimonial?: number;
  metodoAvaliacao?: string;
  outrosSocios?: { nome: string; percentual: number }[];
  observacoes?: string;
  /** Resumo gerado por IA ao interpretar o documento societário anexado. */
  resumo?: string;
  source: 'dec' | 'pdf' | 'manual';
  needsReview: boolean;
  anexos?: RecordAnexo[];
}

// ── Certidão de Casamento ─────────────────────────────────────────────────────

export interface CertidaoCasamento {
  data?: string
  matricula?: string
  cartorio?: string
  regimeBens?: string
  implicacaoSuccessoria?: string
  nomeConjugeAntes?: string
  nomeConjugeApos?: string
}

// ── Contato Essencial (prioridade para acionar em caso de falecimento) ─────────

export type UrgenciaContato = 'urgente' | 'importante' | 'normal' | 'condicional'

export interface ContatoEssencial {
  prioridade: string           // '1', '2', … ordenação
  urgencia: UrgenciaContato
  nome: string
  funcao: string
  contato?: string             // telefone, e-mail, endereço — campo livre
  observacao?: string
}

// ── Documento / Pasta no Dropbox ou repositório digital ─────────────────────

export interface DocumentoDropbox {
  descricao: string
  caminho: string              // ex: "NCM Dropbox → Eric Fonseca → EMF Personal → Documents"
  conteudo?: string            // o que está na pasta/arquivo
  acesso?: string              // como acessar
  responsavel?: string         // pessoa/contato responsável por esta pasta
}

// ── Pessoas ───────────────────────────────────────────────────────────────────

/** Campos uniformes para dependentes e relações importantes */
export interface Familiar {
  nome: string;
  relacao: string;
  cpf?: string;
  email?: string;
  telefone?: string;
}

export interface RelacaoImportante {
  nome: string;
  relacao: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  observacao?: string;
}

// ── Mídia familiar ────────────────────────────────────────────────────────────

export interface MidiaFamiliar {
  label: string       // "Fotos de família", "Álbum casamento", etc.
  url: string         // Google Fotos, iCloud, Drive, YouTube…
  plataforma?: string // label automático detectado da URL
}

// ── Briefing ──────────────────────────────────────────────────────────────────

export interface BriefingCliente {
  intencoesPartilha?: string;
  tutoresCuradores?: string;
  conselheirosConfianca?: {
    nome: string;
    papel: string;
    telefone?: string;
    email?: string;
  }[];
  diretrizes?: string;
}

// ── Documentos vitais ─────────────────────────────────────────────────────────

export type DocumentoStatus = 'pendente' | 'enviado'

export interface DocumentoVital {
  categoria: string
  nome: string
  fileName?: string
  storagePath?: string
  uploadedAt?: string
  status: DocumentoStatus
}

// ── Instituição Financeira Custodiante ────────────────────────────────────────

export interface ContatoInstituicao {
  nome?: string
  email?: string
  telefone?: string
}

export interface InstituicaoFinanceira {
  nome: string
  contatoPrimario?: ContatoInstituicao
  contatoSecundario?: ContatoInstituicao
}

// ── Crédito ───────────────────────────────────────────────────────────────────

export type StatusCredito = 'ativo' | 'em_atraso' | 'renegociado' | 'quitado'

export interface AnexoCredito {
  nome: string
  fileName?: string
  storagePath?: string
  uploadedAt?: string
  status: 'pendente' | 'enviado'
}

export interface CreditoRecord {
  devedor: string
  tipoPessoa: 'PF' | 'PJ'
  cnpjCpf?: string
  valorPrincipal: number
  taxaJuros?: string
  dataVencimento?: string
  tipoInstrumento?: string
  garantias?: string
  statusCredito?: StatusCredito
  observacoes?: string
  /** Resumo gerado por IA ao interpretar o contrato anexado. */
  resumo?: string
  anexos?: AnexoCredito[]
  source: 'dec' | 'pdf' | 'manual'
  needsReview?: boolean
}

// ── Classificação do Advisor para Outros Bens ────────────────────────────────

export type ClassificacaoAdvisor =
  | 'skip'
  | 'outro_bem'
  | 'ativo_financeiro'
  | 'imovel'
  | 'participacao'
  | 'credito'

/** Destinos válidos ao mover um item de uma seção para outra. */
export type DestinoReclassificacao = Exclude<ClassificacaoAdvisor, 'skip'>

/**
 * Item bruto do bucket 'skip' (Grupo 02 + 99) — capturado no generator com
 * campos suficientes para os builders. Advisor classifica via UI; Reprocessar
 * aplica a classificação às seções.
 */
export interface OutroBemItem {
  grupo: string
  codigo: string
  discriminacao: string
  situacaoAtual: number
  cnpj?: string
  localizacao?: string
  paisLocalizacao?: string
  source: 'dec' | 'pdf' | 'manual'
  classificacaoAdvisor?: ClassificacaoAdvisor
  notaAdvisor?: string
}

/**
 * Item na seção "Outros Bens e Direitos".
 * Nasce aqui por padrão (grupo 02 + 99 do IRPF).
 * classificacaoAdvisor: quando definido como algo diferente de 'outro_bem',
 * o item será movido para a seção correspondente no próximo Reprocessar.
 */
export interface OutroBemEDireitoRecord {
  descricao: string
  grupo: string
  codigo: string
  valor: number
  source: 'dec' | 'pdf' | 'manual'
  needsReview: boolean
  nota?: string
  /** Definido pelo advisor para mover o item a outra seção via Reprocessar. */
  classificacaoAdvisor?: ClassificacaoAdvisor
}

// ── Review flags (gerados pelo generator) ────────────────────────────────────

export interface ReviewFlag {
  section: string;
  field: string;
  message: string;
  severity: 'info' | 'warning' | 'required';
}

// ── Advisor Review (checklist manual + validação automática) ─────────────────

export type AdvisorReviewStatus = 'pendente' | 'ok' | 'nao_aplicavel'

export interface AdvisorReviewItem {
  id: string
  categoria: 'completude' | 'consistencia' | 'qualidade'
  descricao: string
  status: AdvisorReviewStatus
  nota?: string
  // Se gerado automaticamente, guarda o detalhe do problema encontrado
  autoDetalhe?: string
}

// ── PlaybookData root ─────────────────────────────────────────────────────────

export interface PlaybookData {
  clientId: string;
  advisorId: string;
  status: 'ingesting' | 'draft' | 'in_review' | 'approved' | 'delivered';
  createdAt: Date;
  updatedAt: Date;

  dadosPessoais: {
    nome: string;
    cpf: string;
    dataNascimento?: string;
    endereco?: string;
    cidadanias?: string;
    ocupacao?: string;
    email?: string;
    telefone?: string;
    certidaoCasamento?: CertidaoCasamento;
    contatos: { tipo: string; valor: string }[];
    familiares: Familiar[];
    relacoesImportantes?: RelacaoImportante[];
    contatosEssenciais?: ContatoEssencial[];
    documentosDropbox?: DocumentoDropbox[];
    midiaFamiliar?: MidiaFamiliar[];
  };

  briefing?: BriefingCliente;

  imoveis: ImovelRecord[];
  ativosFinanceiros: AtivoFinanceiro[];
  participacoesSocietarias: ParticipacaoSocietaria[];
  creditos?: CreditoRecord[];

  /** Extratos bancários e de corretoras enviados para validação dos ativos */
  extratosAnexos?: RecordAnexo[];

  orientacoesInventario?: string;
  contatosEssenciais?: {
    nome: string;
    papel: string;
    telefone?: string;
    email?: string;
  }[];
  documentosVitais?: DocumentoVital[];
  observacoesAdvisor?: string;

  advisorReview?: AdvisorReviewItem[];

  irpfYearsLoaded: number[];
  reviewFlags: ReviewFlag[];

  /**
   * Total de Bens e Direitos declarado na ficha "Resumo da Declaração" do IRPF.
   * Preservado aqui para reconciliação no UI — a soma das seções não inclui
   * itens sem suporte no MVP (Grupo 02 veículos, 99 outros bens).
   */
  totalIRPFDeclarado?: number;

  /**
   * Soma residual dos itens 'skip' ainda não classificados pelo advisor.
   * Decresce à medida que o advisor classifica itens em outrosBensEDireitos ou outras seções.
   */
  outrosBensValor?: number;

  /**
   * Instituições financeiras custodiantes detectadas automaticamente pelo generator.
   * O advisor preenche os contatos; preservado entre regenerações.
   */
  instituicoesFinanceiras?: InstituicaoFinanceira[];

  /**
   * Itens brutos do bucket 'skip' (Grupo 02 + 99) pendentes de classificação.
   * Populado pelo generator; classificacaoAdvisor é preenchido via UI.
   */
  outrosBens?: OutroBemItem[];

  /**
   * Seção "Outros Bens e Direitos" — itens confirmados pelo advisor após classificação.
   * Populado por applyAdvisorClassifications() no fluxo de Reprocessar.
   */
  outrosBensEDireitos?: OutroBemEDireitoRecord[];
}
