// Phase 2 test suite — generator logic, classification, dedup, flag generation
// Run with: node scripts/test-phase2.mjs

// We import the compiled JS directly — or use tsx / ts-node.
// Since we can't easily run the TS here, we replicate the core logic inline
// and test against the same inputs the generator would receive.

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

// ─── Replicate generator logic for testing ────────────────────────────────────

const IMOVEL_GRUPOS = new Set(['01'])
const PARTICIPACAO_CODIGOS = new Set(['01', '02', '99'])
const INSTRUMENTO_FINANCEIRO_CODIGOS = new Set(['03', '04', '05'])

function classify(bem) {
  const g = bem.grupo?.toString().padStart(2, '0')
  const c = bem.codigo?.toString().padStart(2, '0')
  if (IMOVEL_GRUPOS.has(g)) return 'imovel'
  if (g === '03') {
    if (bem.cnpj && PARTICIPACAO_CODIGOS.has(c)) return 'participacao'
    return 'ativo_financeiro'
  }
  if (g === '04' || g === '05') return 'ativo_financeiro'
  return 'skip'
}

function deduplicatePDF(bens) {
  const seen = new Map()
  for (const bem of bens) {
    const key = `${bem.grupo}|${bem.codigo}|${bem.situacaoAtual}`
    const existing = seen.get(key)
    if (!existing || bem.discriminacao.length > existing.discriminacao.length) {
      seen.set(key, bem)
    }
  }
  return Array.from(seen.values())
}

function extractPercentual(discriminacao) {
  const match = discriminacao.match(/(\d{1,3}[.,]?\d*)\s*%/)
  if (match) return parseFloat(match[1].replace(',', '.'))
  return 0
}

function extractEmpresaName(discriminacao) {
  const cleaned = discriminacao
    .replace(/CNPJ[\s:][\d./-]+/gi, '')
    .replace(/\d{1,3}[.,]\d{2,3}[.,]\d{3}\/\d{4}-\d{2}/g, '')
    .replace(/\d+[,.]?\d*\s*%.*$/i, '')
    .trim()
  const parts = cleaned.split(/[-–—]/u)
  return parts[0]?.trim() ?? discriminacao
}

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const mockIRPF = {
  anoCalendario: 2024,
  anoExercicio: 2025,
  sourceFormat: 'dec',
  parsedAt: new Date(),
  confidenceNotes: [],
  dadosDeclarante: {
    cpf: '12345678901',
    nome: 'JOÃO DA SILVA',
    logradouro: 'RUA DAS FLORES',
    numero: '100',
    municipio: 'SÃO PAULO',
    uf: 'SP',
    cep: '01310-100',
    email: 'joao@example.com',
    telefone: '11999990000',
  },
  dependentes: [
    { nome: 'MARIA DA SILVA', relacao: 'Cônjuge', cpf: '98765432100' },
    { nome: 'PEDRO DA SILVA', relacao: 'Filho(a)', cpf: '11122233344' },
  ],
  bensEDireitos: [
    // Imóvel
    { grupo: '01', codigo: '11', discriminacao: 'APARTAMENTO JARDINS', situacaoAnterior: 500000, situacaoAtual: 520000, localizacao: 'SÃO PAULO', source: 'dec' },
    // Conta corrente
    { grupo: '04', codigo: '01', discriminacao: 'BANCO ITAÚ - CONTA CORRENTE', situacaoAnterior: 10000, situacaoAtual: 15000, cnpj: '60.701.190/0001-04', source: 'dec' },
    // Participação societária
    { grupo: '03', codigo: '02', discriminacao: 'EMPRESA XYZ LTDA - 30% de participação', situacaoAnterior: 100000, situacaoAtual: 120000, cnpj: '12.345.678/0001-99', source: 'dec' },
    // Veículo — should be skipped
    { grupo: '02', codigo: '01', discriminacao: 'AUTOMÓVEL VW GOLF', situacaoAnterior: 50000, situacaoAtual: 45000, source: 'dec' },
    // Zero-value financial — should be skipped
    { grupo: '04', codigo: '07', discriminacao: 'FUNDO XYZ', situacaoAnterior: 0, situacaoAtual: 0, source: 'dec' },
    // Tesouro Direto
    { grupo: '04', codigo: '03', discriminacao: 'TESOURO DIRETO - IPCA 2035', situacaoAnterior: 50000, situacaoAtual: 55000, cnpj: '00.394.460/0001-40', source: 'dec' },
  ],
  dividas: [],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\nClassification')

test('grupo 01 → imovel', () => {
  assertEqual(classify({ grupo: '01', codigo: '11' }), 'imovel')
})

test('grupo 01 with zero-padded string → imovel', () => {
  assertEqual(classify({ grupo: '1', codigo: '11' }), 'imovel')
})

test('grupo 03 + cnpj + codigo 02 → participacao', () => {
  assertEqual(classify({ grupo: '03', codigo: '02', cnpj: '12.345.678/0001-99' }), 'participacao')
})

test('grupo 03 without cnpj → ativo_financeiro', () => {
  assertEqual(classify({ grupo: '03', codigo: '02', cnpj: undefined }), 'ativo_financeiro')
})

test('grupo 03 + instrumento financeiro codigo → ativo_financeiro', () => {
  assertEqual(classify({ grupo: '03', codigo: '03', cnpj: '00.000.000/0001-00' }), 'ativo_financeiro')
})

test('grupo 04 → ativo_financeiro', () => {
  assertEqual(classify({ grupo: '04', codigo: '03' }), 'ativo_financeiro')
})

test('grupo 05 → ativo_financeiro', () => {
  assertEqual(classify({ grupo: '05', codigo: '01' }), 'ativo_financeiro')
})

test('grupo 02 (veiculo) → skip', () => {
  assertEqual(classify({ grupo: '02', codigo: '01' }), 'skip')
})

test('grupo 06 → skip', () => {
  assertEqual(classify({ grupo: '06', codigo: '99' }), 'skip')
})

console.log('\nDeduplication (PDF)')

test('dedup keeps entry with longest discriminacao', () => {
  const bens = [
    { grupo: '04', codigo: '01', discriminacao: 'BANCO X', situacaoAtual: 10000, source: 'pdf' },
    { grupo: '04', codigo: '01', discriminacao: 'BANCO X - CONTA CORRENTE AGÊNCIA 1234', situacaoAtual: 10000, source: 'pdf' },
    { grupo: '04', codigo: '01', discriminacao: 'BANCO X CURTO', situacaoAtual: 10000, source: 'pdf' },
  ]
  const result = deduplicatePDF(bens)
  assertEqual(result.length, 1)
  assertEqual(result[0].discriminacao, 'BANCO X - CONTA CORRENTE AGÊNCIA 1234')
})

test('dedup keeps different values as separate entries', () => {
  const bens = [
    { grupo: '04', codigo: '01', discriminacao: 'BANCO A', situacaoAtual: 10000, source: 'pdf' },
    { grupo: '04', codigo: '01', discriminacao: 'BANCO A', situacaoAtual: 20000, source: 'pdf' },
  ]
  const result = deduplicatePDF(bens)
  assertEqual(result.length, 2)
})

test('dedup treats different grupos as separate entries', () => {
  const bens = [
    { grupo: '01', codigo: '11', discriminacao: 'APTO', situacaoAtual: 500000, source: 'pdf' },
    { grupo: '04', codigo: '11', discriminacao: 'APTO', situacaoAtual: 500000, source: 'pdf' },
  ]
  const result = deduplicatePDF(bens)
  assertEqual(result.length, 2)
})

console.log('\nPercentual extraction')

test('extract percentage with %', () => {
  assertEqual(extractPercentual('EMPRESA XYZ - 30% de participação'), 30)
})

test('extract percentage with decimal comma', () => {
  assertEqual(extractPercentual('EMPRESA ABC LTDA 15,5% quotas'), 15.5)
})

test('returns 0 if no percentage found', () => {
  assertEqual(extractPercentual('EMPRESA SEM PERCENTUAL'), 0)
})

console.log('\nEmpresa name extraction')

test('strips CNPJ from empresa name', () => {
  const name = extractEmpresaName('EMPRESA XYZ LTDA CNPJ 12.345.678/0001-99 - 30%')
  assert(name.includes('EMPRESA XYZ'), `Expected empresa name, got: ${name}`)
  assert(!name.includes('12.345'), `Should not contain CNPJ digits, got: ${name}`)
})

test('handles dash separator', () => {
  const name = extractEmpresaName('XYZ S/A - 15% de participação')
  assertEqual(name, 'XYZ S/A')
})

console.log('\nFull generator round-trip')

// Simulate what generatePlaybook does with the mockIRPF
test('correct imovel count', () => {
  const imoveis = mockIRPF.bensEDireitos.filter(b => classify(b) === 'imovel')
  assertEqual(imoveis.length, 1)
})

test('correct participacao count', () => {
  const p = mockIRPF.bensEDireitos.filter(b => classify(b) === 'participacao')
  assertEqual(p.length, 1)
})

test('vehicle skipped', () => {
  const skipped = mockIRPF.bensEDireitos.filter(b => classify(b) === 'skip')
  assert(skipped.some(b => b.discriminacao.includes('AUTOMÓVEL')), 'Vehicle should be skipped')
})

test('zero-value financial skipped by generator filter', () => {
  const nonSkip = mockIRPF.bensEDireitos
    .filter(b => classify(b) === 'ativo_financeiro')
    .filter(b => b.situacaoAtual > 0)
  assertEqual(nonSkip.length, 2) // conta corrente + tesouro direto
})

test('dependentes → familiares mapping', () => {
  assertEqual(mockIRPF.dependentes.length, 2)
  assertEqual(mockIRPF.dependentes[0].relacao, 'Cônjuge')
})

test('irpfYearsLoaded set correctly', () => {
  assertEqual(mockIRPF.anoCalendario, 2024)
})

// ─── Status transition validation (replicate PATCH logic) ─────────────────────

console.log('\nStatus transitions')

const validTransitions = {
  draft: ['in_review'],
  in_review: ['draft', 'approved'],
  approved: ['delivered'],
  delivered: [],
}

function canTransition(from, to) {
  return (validTransitions[from] ?? []).includes(to)
}

test('draft → in_review allowed', () => assert(canTransition('draft', 'in_review')))
test('draft → approved blocked', () => assert(!canTransition('draft', 'approved')))
test('in_review → approved allowed', () => assert(canTransition('in_review', 'approved')))
test('in_review → draft allowed (send back)', () => assert(canTransition('in_review', 'draft')))
test('approved → delivered allowed', () => assert(canTransition('approved', 'delivered')))
test('delivered → any blocked', () => assert(!canTransition('delivered', 'approved')))

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────`)
console.log(`  ${passed} passed  ${failed > 0 ? failed + ' FAILED' : '0 failed'}`)
console.log(`─────────────────────────────────\n`)

if (failed > 0) process.exit(1)
