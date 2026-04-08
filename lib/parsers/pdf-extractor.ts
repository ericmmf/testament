import Anthropic from '@anthropic-ai/sdk';
import { IRPFData } from '../types/irpf';

const client = new Anthropic();

export async function extractIRPFFromPDF(
  pdfBuffer: ArrayBuffer
): Promise<IRPFData> {
  const base64PDF = Buffer.from(pdfBuffer).toString('base64');

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
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
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada da API');
  }

  return parseExtractionResponse(content.text);
}

const EXTRACTION_PROMPT = `
Você está analisando uma Declaração de Imposto de Renda (IRPF) brasileira em PDF.

Extraia TODOS os dados disponíveis e retorne APENAS um objeto JSON válido, sem texto adicional, seguindo exatamente esta estrutura:

{
  "anoCalendario": número,
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
      "grupo": "string",
      "codigo": "string",
      "discriminacao": "string",
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
  "confidenceNotes": ["lista de campos que não puderam ser extraídos com certeza"]
}

Regras:
- Valores monetários devem ser números (sem R$, sem pontos de milhar, vírgula substituída por ponto)
- Se um campo não existir no documento, use null
- Em confidenceNotes, liste qualquer campo que estava ilegível, ausente ou ambíguo
- Não invente dados — se não estiver no documento, deixe null
`;

function parseExtractionResponse(text: string): IRPFData {
  // Strip markdown code blocks if present
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Falha ao interpretar resposta JSON da extração por PDF');
  }

  const confidenceNotes: string[] = parsed.confidenceNotes || [];
  confidenceNotes.push('Extraído via PDF — revisar todos os valores com o cliente');

  return {
    anoCalendario: parsed.anoCalendario || new Date().getFullYear() - 1,
    anoExercicio: (parsed.anoCalendario || new Date().getFullYear() - 1) + 1,
    dadosDeclarante: parsed.dadosDeclarante,
    dependentes: parsed.dependentes || [],
    bensEDireitos: (parsed.bensEDireitos || []).map((b: any) => ({
      ...b,
      source: 'pdf' as const,
    })),
    dividas: parsed.dividas || [],
    parsedAt: new Date(),
    sourceFormat: 'pdf',
    confidenceNotes,
  };
}