/**
 * Classification regression tests — playbook-generator.ts
 *
 * WHY THIS FILE EXISTS:
 * In April 2026, XP brokerage accounts and other financial instruments were
 * appearing under Imóveis in the playbook because:
 *   1. Haiku assigned grupo "01" to financial items based on PDF layout
 *   2. classify() was checking IMOVEL_GRUPOS before discriminação keywords
 *
 * These tests lock down every known failure case. Add a test case here
 * whenever a new misclassification is found in production — BEFORE fixing
 * the generator code. Red test → fix → green test = regression covered.
 *
 * Run: npx vitest run lib/generators/__tests__/classify.test.ts
 */

import { describe, it, expect } from 'vitest'
import { classify, isBolsaOrFII, isFinancialAsset, isCreditoAReceber } from '../playbook-generator'
import type { BemOuDireito } from '../../types/irpf'

// ── Fixture builder ───────────────────────────────────────────────────────────

function bem(overrides: Partial<BemOuDireito>): BemOuDireito {
  return {
    grupo: '01',
    codigo: '11',
    discriminacao: '',
    situacaoAnterior: 0,
    situacaoAtual: 100000,
    source: 'pdf',
    ...overrides,
  }
}

// ── isBolsaOrFII ─────────────────────────────────────────────────────────────

describe('isBolsaOrFII', () => {
  it('detects FII ticker', () => expect(isBolsaOrFII('KNRI11 - Kinea Renda Imobiliária')).toBe(true))
  it('detects XPML11', () => expect(isBolsaOrFII('XPML11 FII SHOPPING CENTERS')).toBe(true))
  it('detects VALE3', () => expect(isBolsaOrFII('VALE3 - VALE S.A.')).toBe(true))
  it('detects FDO abbreviation', () => expect(isBolsaOrFII('FDO INVEST RENDA FIXA')).toBe(true))
  it('detects FICFI', () => expect(isBolsaOrFII('FICFI MULTIMERCADO MASTER')).toBe(true))
  it('detects ETF', () => expect(isBolsaOrFII('BOVA11 ETF IBOVESPA')).toBe(true))
  it('does not flag a real property', () => expect(isBolsaOrFII('APTO 302 ED MARIANA RUA XV 100')).toBe(false))
})

// ── isFinancialAsset ──────────────────────────────────────────────────────────

describe('isFinancialAsset', () => {
  // ── XP variants — the original bug ────────────────────────────────────────
  it('catches "XP" standalone', () => expect(isFinancialAsset('XP')).toBe(true))
  it('catches "XP INVESTIMENTOS"', () => expect(isFinancialAsset('XP INVESTIMENTOS - CONTA CORRENTE')).toBe(true))
  it('catches "XP CORRETORA"', () => expect(isFinancialAsset('XP CORRETORA DE VALORES')).toBe(true))
  it('catches "XP" with dash', () => expect(isFinancialAsset('XP - SALDO DISPONIVEL')).toBe(true))
  it('catches "XP CCTVM"', () => expect(isFinancialAsset('XP CCTVM S.A.')).toBe(true))

  // ── Other institutions ─────────────────────────────────────────────────────
  it('catches Itaú', () => expect(isFinancialAsset('ITAÚ UNIBANCO - CDB')).toBe(true))
  it('catches BTG', () => expect(isFinancialAsset('BTG PACTUAL SALDO')).toBe(true))
  it('catches Nubank', () => expect(isFinancialAsset('NUBANK - CONTA CORRENTE')).toBe(true))
  it('catches Bradesco', () => expect(isFinancialAsset('BRADESCO - POUPANÇA')).toBe(true))

  // ── Product keywords ───────────────────────────────────────────────────────
  it('catches CDB', () => expect(isFinancialAsset('CDB BRADESCO 120% CDI')).toBe(true))
  it('catches LCI', () => expect(isFinancialAsset('LCI ITAÚ 95% CDI')).toBe(true))
  it('catches LCA', () => expect(isFinancialAsset('LCA BANCO DO BRASIL')).toBe(true))
  it('catches Tesouro Selic', () => expect(isFinancialAsset('TESOURO SELIC 2026')).toBe(true))
  it('catches Tesouro IPCA', () => expect(isFinancialAsset('TESOURO IPCA+ 2035')).toBe(true))
  it('catches PGBL', () => expect(isFinancialAsset('PGBL BRADESCO VIDA')).toBe(true))
  it('catches VGBL', () => expect(isFinancialAsset('VGBL XP INVESTIMENTOS')).toBe(true))
  it('catches saldo', () => expect(isFinancialAsset('SALDO EM CONTA CORRENTE')).toBe(true))
  it('catches conta corrente', () => expect(isFinancialAsset('CONTA CORRENTE SANTANDER')).toBe(true))
  it('catches conta investimento', () => expect(isFinancialAsset('CONTA INVESTIMENTO XP')).toBe(true))
  it('catches fundo', () => expect(isFinancialAsset('FUNDO MULTIMERCADO BTG')).toBe(true))
  it('catches depósito a prazo', () => expect(isFinancialAsset('DEPOSITO A PRAZO CAIXA')).toBe(true))

  // ── Must NOT flag real estate ──────────────────────────────────────────────
  it('does not flag apartment', () => expect(isFinancialAsset('APARTAMENTO 102 - RUA AUGUSTA 500 SAO PAULO')).toBe(false))
  it('does not flag farmland', () => expect(isFinancialAsset('FAZENDA SAO JOSE - MUNICIPIO DE UBERLANDIA MG')).toBe(false))
  it('does not flag commercial property', () => expect(isFinancialAsset('SALA COMERCIAL 304 ED EMPRESARIAL')).toBe(false))
})

// ── isCreditoAReceber ─────────────────────────────────────────────────────────

describe('isCreditoAReceber', () => {
  it('catches dividendos a receber', () => expect(isCreditoAReceber('EMPRESA XYZ - DIVIDENDOS A RECEBER')).toBe(true))
  it('catches JCP', () => expect(isCreditoAReceber('JCP A RECEBER - PERIODO 2023')).toBe(true))
  it('catches lucros a distribuir', () => expect(isCreditoAReceber('LUCROS A DISTRIBUIR - HOLDING')).toBe(true))
  it('does not flag a regular investment', () => expect(isCreditoAReceber('XP INVESTIMENTOS - CARTEIRA')).toBe(false))
})

// ── classify() — end-to-end ───────────────────────────────────────────────────
// These are the critical regression cases. Each one was (or could be)
// a production misclassification.

describe('classify — financial assets must never become imovel', () => {

  // ── The original bug: XP accounts misassigned to grupo 01 ─────────────────
  it('XP conta corrente with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'XP INVESTIMENTOS - CONTA CORRENTE' }))).toBe('ativo_financeiro'))

  it('XP saldo with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'XP - SALDO DISPONIVEL R$ 42.000' }))).toBe('ativo_financeiro'))

  it('XP standalone with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'XP' }))).toBe('ativo_financeiro'))

  it('CDB with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'CDB ITAU 110% CDI VENC 2025' }))).toBe('ativo_financeiro'))

  it('Tesouro Direto with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'TESOURO SELIC 2026' }))).toBe('ativo_financeiro'))

  it('PGBL with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'PGBL BRADESCO VIDA E PREVIDENCIA' }))).toBe('ativo_financeiro'))

  it('Fundo multimercado with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'FUNDO BTG PACTUAL MULTIMERCADO' }))).toBe('ativo_financeiro'))

  it('Nubank conta with grupo 01 → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'NUBANK - CONTA CORRENTE' }))).toBe('ativo_financeiro'))
})

describe('classify — real estate must stay as imovel', () => {
  it('apartment → imovel', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'APARTAMENTO 102 RUA AUGUSTA 500 SAO PAULO SP' }))).toBe('imovel'))

  it('farmland → imovel', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'FAZENDA SAO JOSE MUNICIPIO UBERLANDIA MG' }))).toBe('imovel'))

  it('commercial property → imovel', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'SALA COMERCIAL 304 ED EMPRESARIAL FARIA LIMA' }))).toBe('imovel'))

  it('terreno → imovel', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'TERRENO LOTE 14 QUADRA 7 BAIRRO JARDIM' }))).toBe('imovel'))
})

describe('classify — grupo 03 routing', () => {
  it('private company quota with CNPJ → participacao', () =>
    expect(classify(bem({
      grupo: '03', codigo: '02',
      discriminacao: 'QUOTA SOCIAL NA EMPRESA ABC LTDA',
      cnpj: '12.345.678/0001-99',
    }))).toBe('participacao'))

  it('private company quota WITHOUT CNPJ → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '03', codigo: '02', discriminacao: 'QUOTA EMPRESA SEM CNPJ', cnpj: undefined }))).toBe('ativo_financeiro'))

  it('listed stock ticker → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '03', codigo: '02', discriminacao: 'VALE3 - VALE S.A.', cnpj: '33.592.510/0001-54' }))).toBe('ativo_financeiro'))

  it('FII with quota code → ativo_financeiro', () =>
    expect(classify(bem({ grupo: '03', codigo: '02', discriminacao: 'KNRI11 FII KINEA RENDA IMOB' }))).toBe('ativo_financeiro'))
})

describe('classify — credito routing', () => {
  it('dividendos a receber → credito', () =>
    expect(classify(bem({ grupo: '05', codigo: '02', discriminacao: 'EMPRESA XYZ - DIVIDENDOS A RECEBER' }))).toBe('credito'))

  it('dividendos a receber even on grupo 01 → credito', () =>
    expect(classify(bem({ grupo: '01', discriminacao: 'HOLDING ABC - DIVIDENDOS A RECEBER 2023' }))).toBe('credito'))
})
