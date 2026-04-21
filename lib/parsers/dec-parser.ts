import { DOMParser, Document as XMLDocument, Element as XMLElement } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { IRPFData, BemOuDireito, Dependente, Divida } from '../types/irpf';

// The .DEC file is a ZIP archive containing XML data
// produced by Receita Federal's IRPF program (2015+)

function isZip(buffer: ArrayBuffer): boolean {
  // ZIP magic bytes: PK\x03\x04
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// Some IRPF versions prepend a flat-text header before the ZIP payload.
// Scan the entire buffer for the first PK\x03\x04 signature.
function findZipOffset(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
      return i;
    }
  }
  return -1;
}

export async function parseDEC(fileBuffer: ArrayBuffer): Promise<IRPFData> {
  let xmlString: string;

  const zipOffset = findZipOffset(fileBuffer);

  if (zipOffset >= 0) {
    // ZIP found — may be at offset 0 (pure ZIP) or after a flat header
    const zipBuffer = fileBuffer.slice(zipOffset);
    const zip = await JSZip.loadAsync(zipBuffer);
    const xmlFile = findMainXML(zip);
    if (!xmlFile) {
      throw new Error('Arquivo .DEC inválido: XML principal não encontrado no ZIP');
    }
    xmlString = await xmlFile.async('string');
  } else {
    // No ZIP found — Receita Federal flat fixed-width format (pre-2015 or specific versions)
    throw new Error('DEC_FLAT_FORMAT: arquivo usa formato de largura fixa (não ZIP+XML). Parser não implementado.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // @xmldom/xmldom does not support querySelector — use getElementsByTagName
  const parseError = doc.getElementsByTagName('parsererror')[0];
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

function extractIRPFData(doc: XMLDocument): IRPFData {
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

function extractYear(doc: XMLDocument, notes: string[]): number {
  const candidates = [
    'anoCalendario',
    'anoCal',
    'exercicio',
    'anoExercicio',
  ];

  for (const tag of candidates) {
    const el = doc.getElementsByTagName(tag)[0];
    if (el?.textContent) {
      const year = parseInt(el.textContent.trim());
      if (year > 2000 && year < 2100) return year;
    }
  }

  // Try attribute on root element
  const root = doc.documentElement;
  const yearAttr = root?.getAttribute('anoCalendario') ||
                   root?.getAttribute('exercicio');
  if (yearAttr) {
    const year = parseInt(yearAttr);
    if (year > 2000) return year;
  }

  notes.push('Ano-calendário não identificado — confirmar com o cliente');
  return new Date().getFullYear() - 1;
}

function extractDadosDeclarante(
  doc: XMLDocument,
  notes: string[]
): IRPFData['dadosDeclarante'] {
  // Try both possible container element names
  const container: XMLElement =
    doc.getElementsByTagName('DadosDeclarante')[0] ||
    doc.getElementsByTagName('Declarante')[0] ||
    doc.documentElement as XMLElement;

  const get = (tags: string[]): string => {
    for (const tag of tags) {
      const inContainer = container.getElementsByTagName(tag)[0];
      if (inContainer?.textContent?.trim()) return inContainer.textContent.trim();
      const inDoc = doc.getElementsByTagName(tag)[0];
      if (inDoc?.textContent?.trim()) return inDoc.textContent.trim();
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

function extractDependentes(doc: XMLDocument): Dependente[] {
  const containers = [
    ...Array.from(doc.getElementsByTagName('Dependente')),
    ...Array.from(doc.getElementsByTagName('dependente')),
  ];

  return containers.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.getElementsByTagName(tag)[0];
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
  doc: XMLDocument,
  notes: string[]
): BemOuDireito[] {
  const items = [
    ...Array.from(doc.getElementsByTagName('BemOuDireito')),
    ...Array.from(doc.getElementsByTagName('bemOuDireito')),
    ...Array.from(doc.getElementsByTagName('Bem')),
  ];

  if (items.length === 0) {
    notes.push('Bens e Direitos não encontrados — verificar estrutura do arquivo');
  }

  return items.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.getElementsByTagName(tag)[0];
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

function extractDividas(doc: XMLDocument): Divida[] {
  const items = [
    ...Array.from(doc.getElementsByTagName('Divida')),
    ...Array.from(doc.getElementsByTagName('divida')),
    ...Array.from(doc.getElementsByTagName('DividaOnus')),
  ];

  return items.map(el => {
    const get = (tags: string[]) => {
      for (const tag of tags) {
        const child = el.getElementsByTagName(tag)[0];
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
