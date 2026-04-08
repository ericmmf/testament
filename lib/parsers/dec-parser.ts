import JSZip from 'jszip';
import { IRPFData, BemOuDireito, Dependente, Divida } from '../types/irpf';

// The .DEC file is a ZIP archive containing XML data
// produced by Receita Federal's IRPF program (2015+)

export async function parseDEC(fileBuffer: ArrayBuffer): Promise<IRPFData> {
  const zip = await JSZip.loadAsync(fileBuffer);
  
  // Find the main XML file inside the ZIP
  const xmlFile = findMainXML(zip);
  if (!xmlFile) {
    throw new Error('Arquivo .DEC inválido: XML principal não encontrado');
  }

  const xmlString = await xmlFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Erro ao interpretar XML do arquivo .DEC');
  }

  return extractIRPFData(doc);
}

function findMainXML(zip: JSZip): JSZip.JSZipObject | null {
  // Common filenames used across IRPF program versions
  const candidates = [
    'Declaracao.xml',
    'declaracao.xml', 
    'irpf.xml',
    'IRPF.xml',
  ];

  for (const name of candidates) {
    const file = zip.file(name);
    if (file) return file;
  }

  // Fallback: find any .xml file in the ZIP root
  const xmlFiles = Object.keys(zip.files).filter(
    name => name.endsWith('.xml') && !name.includes('/')
  );
  
  return xmlFiles.length > 0 ? zip.file(xmlFiles[0]) : null;
}

function extractIRPFData(doc: Document): IRPFData {
  const confidenceNotes: string[] = [];

  // Extract year — try multiple possible element names
  const anoCalendario = extractYear(doc, confidenceNotes);

  // Personal data
  const dadosDeclarante = extractDadosDeclarante(doc, confidenceNotes);

  // Dependents
  const dependentes = extractDependentes(doc);

  // Assets
  const bensEDireitos = extractBensEDireitos(doc, confidenceNotes);

  // Debts
  const dividas = extractDividas(doc);

  return {
    anoCalendario,
    anoExercicio: anoCalendario + 1,
    dadosDeclarante,
    dependentes,
    bensEDireitos,
    dividas,
    parsedAt: new Date(),
    sourceFormat: 'dec',
    confidenceNotes,
  };
}

function extractYear(doc: Document, notes: string[]): number {
  const candidates = [
    'anoCalendario',
    'anoCal',
    'exercicio',
    'anoExercicio',
  ];

  for (const tag of candidates) {
    const el = doc.querySelector(tag);
    if (el?.textContent) {
      const year = parseInt(el.textContent.trim());
      if (year > 2000 && year < 2100) return year;
    }
  }

  // Try attribute on root element
  const root = doc.documentElement;
  const yearAttr = root.getAttribute('anoCalendario') || 
                   root.getAttribute('exercicio');
  if (yearAttr) {
    const year = parseInt(yearAttr);
    if (year > 2000) return year;
  }

  notes.push('Ano-calendário não identificado — confirmar com o cliente');
  return new Date().getFullYear() - 1;
}

function extractDadosDeclarante(
  doc: Document, 
  notes: string[]
): IRPFData['dadosDeclarante'] {
  // Try both possible container element names
  const container = 
    doc.querySelector('DadosDeclarante') ||
    doc.querySelector('Declarante') ||
    doc.documentElement;

  const get = (tags: string[]): string => {
    for (const tag of tags) {
      const el = container.querySelector(tag) || doc.querySelector(tag);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return '';
  };

  const cpf = get(['cpf', 'CPF', 'nrCpf']);
  const nome = get(['nome', 'nomeDeclarante', 'Nome']);

  if (!cpf) notes.push('CPF não encontrado no arquivo — inserir manualmente');
  if (!nome) notes.push('Nome do declarante não encontrado — inserir manualmente');

  return {
    cpf,
    nome,
    dataNascimento: get(['dataNascimento', 'dtNascimento']),
    ocupacaoPrincipal: get(['ocupacaoPrincipal', 'ocupacao']),
    logradouro: get(['logradouro', 'endereco']),
    numero: get(['numero', 'nrLogradouro']),
    complemento: get(['complemento']),
    bairro: get(['bairro']),
    municipio: get(['municipio', 'cidade']),
    uf: get(['uf', 'estado', 'UF']),
    cep: get(['cep', 'CEP']),
    telefone: get(['telefone', 'fone']),
    email: get(['email', 'eMail']),
  };
}

function extractDependentes(doc: Document): Dependente[] {
  const containers = [
    ...Array.from(doc.querySelectorAll('Dependente')),
    ...Array.from(doc.querySelectorAll('dependente')),
  ];

  return containers.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.querySelector(tag);
        if (child?.textContent?.trim()) return child.textContent.trim();
        const attr = el.getAttribute(tag);
        if (attr) return attr;
      }
      return '';
    };

    return {
      nome: get(['nome', 'nomeDependente']),
      cpf: get(['cpf', 'CPF']),
      dataNascimento: get(['dataNascimento', 'dtNascimento']),
      relacao: get(['relacao', 'tipoRelacao', 'grauParentesco']),
    };
  });
}

function extractBensEDireitos(
  doc: Document,
  notes: string[]
): BemOuDireito[] {
  const items = [
    ...Array.from(doc.querySelectorAll('BemOuDireito')),
    ...Array.from(doc.querySelectorAll('bemOuDireito')),
    ...Array.from(doc.querySelectorAll('Bem')),
  ];

  if (items.length === 0) {
    notes.push('Bens e Direitos não encontrados — verificar estrutura do arquivo');
  }

  return items.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.querySelector(tag);
        if (child?.textContent?.trim()) return child.textContent.trim();
        const attr = el.getAttribute(tag);
        if (attr) return attr;
      }
      return '';
    };

    const getNum = (tags: string[]): number => {
      const val = get(tags);
      return val ? parseFloat(val.replace(',', '.')) : 0;
    };

    return {
      grupo: get(['grupo', 'cdGrupo', 'grupoItem']),
      codigo: get(['codigo', 'cdCodigo', 'codigoItem']),
      discriminacao: get(['discriminacao', 'descricao', 'Discriminacao']),
      situacaoAnterior: getNum(['situacaoAnterior', 'vlSituacaoAnterior', 'valorAnterior']),
      situacaoAtual: getNum(['situacaoAtual', 'vlSituacaoAtual', 'valorAtual']),
      localizacao: get(['localizacao', 'municipioLocalizacao']) || undefined,
      cnpj: get(['cnpj', 'CNPJ', 'cnpjInstituicao']) || undefined,
      paisLocalizacao: get(['paisLocalizacao', 'pais']) || undefined,
      source: 'dec' as const,
    };
  });
}

function extractDividas(doc: Document): Divida[] {
  const items = [
    ...Array.from(doc.querySelectorAll('Divida')),
    ...Array.from(doc.querySelectorAll('divida')),
    ...Array.from(doc.querySelectorAll('DividaOnus')),
  ];

  return items.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.querySelector(tag);
        if (child?.textContent?.trim()) return child.textContent.trim();
        const attr = el.getAttribute(tag);
        if (attr) return attr;
      }
      return '';
    };

    const getNum = (tags: string[]): number => {
      const val = get(tags);
      return val ? parseFloat(val.replace(',', '.')) : 0;
    };

    return {
      codigoCredor: get(['codigoCredor', 'codigo']),
      cnpjCpfCredor: get(['cnpjCpfCredor', 'cnpj', 'cpfCredor']) || undefined,
      descricao: get(['descricao', 'discriminacao']),
      saldoAnterior: getNum(['saldoAnterior', 'vlSaldoAnterior']),
      saldoAtual: getNum(['saldoAtual', 'vlSaldoAtual']),
    };
  });
}