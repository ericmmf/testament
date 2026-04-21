// IRPF data types — maps to Receita Federal's declaration structure

export interface DadosDeclarante {
  cpf: string;
  nome: string;
  dataNascimento?: string;
  ocupacaoPrincipal?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
}

export interface Dependente {
  nome: string;
  cpf?: string;
  dataNascimento?: string;
  relacao: string;
}

export interface BemOuDireito {
  grupo: string;
  codigo: string;
  discriminacao: string;
  situacaoAnterior: number;
  situacaoAtual: number;
  localizacao?: string;
  cnpj?: string;
  paisLocalizacao?: string;
  source: 'dec' | 'pdf' | 'manual';
}

export interface Divida {
  codigoCredor: string;
  cnpjCpfCredor?: string;
  descricao: string;
  saldoAnterior: number;
  saldoAtual: number;
}

export interface IRPFData {
  anoCalendario: number;
  anoExercicio: number;
  dadosDeclarante: DadosDeclarante;
  dependentes: Dependente[];
  bensEDireitos: BemOuDireito[];
  dividas: Divida[];
  // Extracted from "Resumo da Declaração" or "Evolução Patrimonial" —
  // used to verify that sum of bensEDireitos.situacaoAtual matches.
  totalBensEDireitosDeclarado?: number;
  parsedAt: Date;
  sourceFormat: 'dec' | 'pdf';
  confidenceNotes: string[];
}