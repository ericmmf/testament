'use client'

import { useState } from 'react'
import { CreditoRecord, StatusCredito, DestinoReclassificacao } from '@/lib/types/playbook'
import { formatBRL } from './utils'
import { ContratosPanel, DocRecord } from './ContratosPanel'
import { ReviewFlag } from '@/lib/types/playbook'

interface Props {
  creditos: CreditoRecord[]
  clientId: string
  onChange: (items: CreditoRecord[]) => void
  onReclassify?: (index: number, destino: DestinoReclassificacao) => void
}

const INSTRUMENTOS = ['CCB', 'CCI', 'Mútuo', 'Debênture', 'CRA', 'CRI', 'Nota Promissória', 'Outro']

const STATUS_LABELS: Record<StatusCredito, string> = {
  ativo:       'Ativo',
  em_atraso:   'Em atraso',
  renegociado: 'Renegociado',
  quitado:     'Quitado',
}

const STATUS_COLORS: Record<StatusCredito, string> = {
  ativo:       'bg-emerald-500/20 text-emerald-300',
  em_atraso:   'bg-red-500/20 text-red-300',
  renegociado: 'bg-olive-500/20 text-olive-300',
  quitado:     'bg-white/10 text-olive-200',
}

function EditField({
  label, value, onChange, placeholder, type = 'text', mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

function CreditoCard({
  credito,
  index,
  clientId,
  onUpdate,
  onMerge,
  onRemove,
  onReclassify,
}: {
  credito: CreditoRecord
  index: number
  clientId: string
  onUpdate: (field: keyof CreditoRecord, value: unknown) => void
  onMerge: (fields: Partial<CreditoRecord>) => void
  onRemove: () => void
  onReclassify?: (destino: DestinoReclassificacao) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const initials = (credito.devedor || 'CR')
    .split(/[\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  // Convert AnexoCredito[] (from CreditoRecord) ↔ DocRecord[]
  const docs: DocRecord[] = (credito.anexos ?? []).map(a => ({
    nome:       a.nome,
    fileName:   a.fileName,
    storagePath:a.storagePath,
    uploadedAt: a.uploadedAt,
    status:     a.status,
  }))

  function handleDocsUpdate(updated: DocRecord[]) {
    onUpdate('anexos', updated.map(d => ({
      nome:       d.nome ?? d.fileName ?? 'Documento',
      fileName:   d.fileName,
      storagePath:d.storagePath,
      uploadedAt: d.uploadedAt,
      status:     d.status,
    })))
  }

  // Existing card data for Claude context
  function existingData(): Record<string, unknown> {
    const d: Record<string, unknown> = {}
    if (credito.devedor)         d.devedor         = credito.devedor
    if (credito.tipoPessoa)      d.tipoPessoa      = credito.tipoPessoa
    if (credito.cnpjCpf)         d.cnpjCpf         = credito.cnpjCpf
    if (credito.valorPrincipal)  d.valorPrincipal  = credito.valorPrincipal
    if (credito.taxaJuros)       d.taxaJuros       = credito.taxaJuros
    if (credito.dataVencimento)  d.dataVencimento  = credito.dataVencimento
    if (credito.tipoInstrumento) d.tipoInstrumento = credito.tipoInstrumento
    if (credito.garantias)       d.garantias       = credito.garantias
    if (credito.statusCredito)   d.statusCredito   = credito.statusCredito
    if (credito.observacoes)     d.observacoes     = credito.observacoes
    if (credito.resumo)          d.resumo          = credito.resumo
    return d
  }

  function handleInterpret(fields: Record<string, unknown>) {
    // Map Claude response → CreditoRecord fields
    const mapped: Partial<CreditoRecord> = {}
    if (fields.devedor)          mapped.devedor          = String(fields.devedor)
    if (fields.tipoPessoa === 'PF' || fields.tipoPessoa === 'PJ')
                                  mapped.tipoPessoa       = fields.tipoPessoa
    if (fields.cnpjCpf)           mapped.cnpjCpf          = String(fields.cnpjCpf)
    if (typeof fields.valorPrincipal === 'number' && fields.valorPrincipal > 0)
                                  mapped.valorPrincipal   = fields.valorPrincipal
    if (fields.taxaJuros)         mapped.taxaJuros        = String(fields.taxaJuros)
    if (fields.dataVencimento)    mapped.dataVencimento   = String(fields.dataVencimento)
    if (fields.tipoInstrumento)   mapped.tipoInstrumento  = String(fields.tipoInstrumento)
    if (fields.garantias)         mapped.garantias        = String(fields.garantias)
    if (fields.statusCredito)     mapped.statusCredito    = fields.statusCredito as StatusCredito
    if (fields.observacoes)       mapped.observacoes      = String(fields.observacoes)
    if (fields.resumo)            mapped.resumo           = String(fields.resumo)
    onMerge(mapped)
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">

      {/* Header */}
      <div className="bg-olive-900 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <input
                value={credito.devedor}
                onChange={e => onUpdate('devedor', e.target.value)}
                placeholder="Nome do devedor"
                className="text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-white/60 focus:outline-none w-full pb-0.5 placeholder-white/40"
              />
              <p className="text-xs font-mono text-olive-200 mt-0.5">
                {credito.cnpjCpf || (credito.tipoPessoa === 'PJ' ? 'CNPJ a preencher' : 'CPF a preencher')}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-olive-200">Principal</p>
            <p className="text-sm font-bold text-white">{formatBRL(credito.valorPrincipal)}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${credito.tipoPessoa === 'PJ' ? 'bg-stone-600/30 text-olive-100' : 'bg-stone-400/30 text-olive-100'}`}>
            {credito.tipoPessoa}
          </span>
          {credito.tipoInstrumento && (
            <span className="text-xs bg-white/10 text-olive-100 px-2 py-0.5 rounded-full font-medium">
              {credito.tipoInstrumento}
            </span>
          )}
          {credito.dataVencimento && (
            <span className="text-xs bg-white/10 text-olive-100 px-2 py-0.5 rounded-full font-medium">
              Venc. {credito.dataVencimento}
            </span>
          )}
          {credito.statusCredito && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[credito.statusCredito]}`}>
              {STATUS_LABELS[credito.statusCredito]}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-amber-50 px-5 py-4 space-y-3">

        {/* Resumo — generated by Claude after interpretation */}
        {credito.resumo && (
          <div className="bg-white border border-olive-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-olive-700 uppercase tracking-wide mb-1">Resumo</p>
            <p className="text-sm text-gray-700 leading-relaxed">{credito.resumo}</p>
          </div>
        )}

        {/* Key metrics strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-100">
            <p className="text-xs text-gray-400">Taxa</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{credito.taxaJuros || '—'}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-100">
            <p className="text-xs text-gray-400">Instrumento</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{credito.tipoInstrumento || '—'}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-100">
            <p className="text-xs text-gray-400">Documentos</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {docs.filter(d => d.status === 'enviado').length || '—'}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-xs text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white hover:bg-gray-100 transition-colors border border-gray-200"
        >
          {expanded ? '▲ Recolher' : '▼ Editar detalhes e contratos'}
        </button>

        {/* Expanded form */}
        {expanded && (
          <div className="space-y-4 pt-1">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tipo pessoa</label>
                <select
                  value={credito.tipoPessoa}
                  onChange={e => onUpdate('tipoPessoa', e.target.value as 'PF' | 'PJ')}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
                >
                  <option value="PJ">PJ — Pessoa Jurídica</option>
                  <option value="PF">PF — Pessoa Física</option>
                </select>
              </div>
              <EditField
                label={credito.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
                value={credito.cnpjCpf ?? ''}
                onChange={v => onUpdate('cnpjCpf', v)}
                mono
                placeholder={credito.tipoPessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
              />
              <EditField
                label="Valor principal (R$)"
                value={String(credito.valorPrincipal)}
                type="number"
                onChange={v => onUpdate('valorPrincipal', parseFloat(v) || 0)}
              />
              <EditField
                label="Taxa de juros"
                value={credito.taxaJuros ?? ''}
                onChange={v => onUpdate('taxaJuros', v)}
                placeholder="Ex: CDI+4% a.a."
              />
              <EditField
                label="Data de vencimento"
                value={credito.dataVencimento ?? ''}
                onChange={v => onUpdate('dataVencimento', v)}
                placeholder="DD/MM/AAAA"
              />
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Instrumento</label>
                <select
                  value={credito.tipoInstrumento ?? ''}
                  onChange={e => onUpdate('tipoInstrumento', e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
                >
                  <option value="">Selecione…</option>
                  {INSTRUMENTOS.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Status</label>
              <select
                value={credito.statusCredito ?? ''}
                onChange={e => onUpdate('statusCredito', e.target.value as StatusCredito)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
              >
                <option value="">Selecione…</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Garantias</label>
              <textarea
                value={credito.garantias ?? ''}
                onChange={e => onUpdate('garantias', e.target.value)}
                rows={2}
                placeholder="Ex: Alienação fiduciária de imóvel, aval pessoal do sócio…"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Observações</label>
              <textarea
                value={credito.observacoes ?? ''}
                onChange={e => onUpdate('observacoes', e.target.value)}
                rows={2}
                placeholder="Contexto adicional, cláusulas relevantes, contatos do devedor…"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white"
              />
            </div>

            {/* Resumo — editable after AI generation */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Resumo da operação</label>
              <textarea
                value={credito.resumo ?? ''}
                onChange={e => onUpdate('resumo', e.target.value)}
                rows={2}
                placeholder="Gerado automaticamente ao interpretar o contrato, ou preencha manualmente…"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white italic"
              />
            </div>

            {/* Contratos panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <ContratosPanel
                docs={docs}
                clientId={clientId}
                categoria={`contrato_credito_${index}`}
                docType="credito"
                existingData={existingData()}
                onUpdate={handleDocsUpdate}
                onInterpret={handleInterpret}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Mover para:</span>
                <select
                  defaultValue=""
                  onChange={e => {
                    const val = e.target.value as DestinoReclassificacao
                    if (val && onReclassify) { onReclassify(val); e.target.value = '' }
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-olive-200"
                >
                  <option value="">Selecione seção…</option>
                  <option value="imovel">Imóveis</option>
                  <option value="ativo_financeiro">Ativos Financeiros</option>
                  <option value="participacao">Participação Societária</option>
                  <option value="outro_bem">Outros Bens</option>
                </select>
              </div>
              <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">
                Remover crédito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CreditoSection({ creditos, clientId, onChange, onReclassify }: Props) {
  function update(i: number, field: keyof CreditoRecord, value: unknown) {
    const updated = [...creditos]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  function merge(i: number, fields: Partial<CreditoRecord>) {
    const updated = [...creditos]
    updated[i] = { ...updated[i], ...fields }
    onChange(updated)
  }

  function remove(i: number) {
    onChange(creditos.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...creditos, {
      devedor:    '',
      tipoPessoa: 'PJ',
      valorPrincipal: 0,
      source:     'manual',
      needsReview:false,
    }])
  }

  const totalAtivo = creditos
    .filter(c => c.statusCredito !== 'quitado')
    .reduce((s, c) => s + c.valorPrincipal, 0)

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-base font-semibold text-gray-900">Crédito Privado e Estruturado</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {creditos.length} {creditos.length === 1 ? 'operação' : 'operações'}
          {totalAtivo > 0 && (
            <> · Saldo ativo: <strong className="text-gray-700">{formatBRL(totalAtivo)}</strong></>
          )}
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Empréstimos e instrumentos de crédito contra devedores PF ou PJ. Anexe o contrato e use "Interpretar" para preencher os campos automaticamente.
        </p>
      </div>

      {creditos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {creditos.map((c, i) => (
            <CreditoCard
              key={i}
              credito={c}
              index={i}
              clientId={clientId}
              onUpdate={(field, value) => update(i, field, value)}
              onMerge={(fields) => merge(i, fields)}
              onRemove={() => remove(i)}
              onReclassify={onReclassify ? (d) => onReclassify(i, d) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">
          Nenhuma operação de crédito registrada.
        </div>
      )}

      <button
        onClick={add}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Adicionar operação de crédito
      </button>
    </div>
  )
}
