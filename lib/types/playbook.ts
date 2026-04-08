// Manual Patrimonial data model

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
}

export interface AtivoFinanceiro {
  instituicao: string;
  tipo: string;
  cnpj?: string;
  valorAproximado: number;
  descricao?: string;
  source: 'dec' | 'pdf' | 'manual';
  needsReview: boolean;
}

export interface ParticipacaoSocietaria {
  empresa: string;
  cnpj: string;
  percentual: number;
  naturezaJuridica?: string;
  valorPatrimonial?: number;
  source: 'dec' | 'pdf' | 'manual';
  needsReview: boolean;
}

export interface ReviewFlag {
  section: string;
  field: string;
  message: string;
  severity: 'info' | 'warning' | 'required';
}

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
    contatos: { tipo: string; valor: string }[];
    familiares: { nome: string; relacao: string; cpf?: string }[];
  };

  imoveis: ImovelRecord[];
  ativosFinanceiros: AtivoFinanceiro[];
  participacoesSocietarias: ParticipacaoSocietaria[];

  orientacoesInventario?: string;
  contatosEssenciais?: {
    nome: string;
    papel: string;
    telefone?: string;
    email?: string;
  }[];
  observacoesAdvisor?: string;

  irpfYearsLoaded: number[];
  reviewFlags: ReviewFlag[];
}