'use client'

import { useState, useEffect, useRef } from 'react'
import { ParticipacaoSocietaria, ReviewFlag, RecordAnexo, DestinoReclassificacao } from '@/lib/types/playbook'
import { formatBRL, flagClasses } from './utils'
import { ContratosPanel, DocRecord } from './ContratosPanel'

interface Props {
  participacoes: ParticipacaoSocietaria[]
  flags: ReviewFlag[]
  clientId: string
  onChange: (items: ParticipacaoSocietaria[]) => void
  onReclassify?: (index: number, destino: DestinoReclassificacao) => void
}

const METODOS_AVALIACAO = [
  'Valor Patrimonial',
  'EBITDA múltiplo',
  'Fluxo de Caixa Descontado',
  'Valor de Mercado',
  'Custo histórico',
  'Outro',
]

function ParticipacaoCard({
  participacao,
  index,
  flags,
  clientId,
  onUpdate,
  onUpdateAnexos,
  onRemove,
  onReclassify,
  onMerge,
}: {
  participacao: ParticipacaoSocietaria
  index: number
  flags: ReviewFlag[]
  clientId: string
  onUpdate: (field: keyof ParticipacaoSocietaria, value: unknown) => void
  onUpdateAnexos: (anexos: RecordAnexo[]) => void
  onRemove: () => void
  onReclassify?: (destino: DestinoReclassificacao) => void
  onMerge: (fields: Partial<ParticipacaoSocietaria>) => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [inferring, setInferring]     = useState(false)
  const hasAutoInferred               = useRef(false)
  const itemFlags = flags.filter(f => f.field.startsWith(`participacoesSocietarias[${index}]`))
  const outrosSocios = participacao.outrosSocios ?? []
  const anexos = (participacao.anexos ?? []) as DocRecord[]

  const initials = (participacao.empresa || 'EM')
    .split(/[\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  // Existing card data serialized for Claude context
  function existingData(): Record<string, unknown> {
    const d: Record<string, unknown> = {}
    if (participacao.empresa)        d.empresa          = participacao.empresa
    if (participacao.cnpj)           d.cnpj             = participacao.cnpj
    if (participacao.percentual)     d.percentual       = participacao.percentual
    if (participacao.naturezaJuridica) d.naturezaJuridica = participacao.naturezaJuridica
    if (participacao.valorPatrimonial) d.valorPatrimonial = participacao.valorPatrimonial
    if (participacao.metodoAvaliacao)  d.metodoAvaliacao  = participacao.metodoAvaliacao
    if ((participacao.outrosSocios ?? []).length > 0) d.outrosSocios = participacao.outrosSocios
    if (participacao.observacoes)    d.observacoes      = participacao.observacoes
    if (participacao.resumo)         d.resumo           = participacao.resumo
    return d
  }

  function handleInterpret(fields: Record<string, unknown>) {
    const merged: Partial<ParticipacaoSocietaria> = {}
    if (typeof fields.empresa      === 'string')  merged.empresa           = fields.empresa
    if (typeof fields.cnpj         === 'string')  merged.cnpj              = fields.cnpj
    if (typeof fields.percentual   === 'number')  merged.percentual        = fields.percentual
    if (typeof fields.naturezaJuridica === 'string') merged.naturezaJuridica = fields.naturezaJuridica
    if (typeof fields.valorPatrimonial === 'number') merged.valorPatrimonial = fields.valorPatrimonial
    if (typeof fields.metodoAvaliacao  === 'string') merged.metodoAvaliacao  = fields.metodoAvaliacao
    if (Array.isArray(fields.outrosSocios))        merged.outrosSocios     = fields.outrosSocios as { nome: string; percentual: number }[]
    if (typeof fields.observacoes  === 'string')  merged.observacoes       = fields.observacoes
    if (typeof fields.resumo       === 'string')  merged.resumo            = fields.resumo
    onMerge(merged)
  }

  // Inference-only: guess empresa name + summary from existing structured data
  async function inferTitle() {
    setInferring(true)
    try {
      const res = await fetch('/api/interpret-doc', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ docType: 'participacao', inferOnly: true, existingData: existingData() }),
      })
      if (!res.ok) return
      const { fields } = await res.json()
      handleInterpret(fields)
    } catch { /* silent */ } finally {
      setInferring(false)
    }
  }

  function addSocio() {
    onUpdate('outrosSocios', [...outrosSocios, { nome: '', percentual: 0 }])
  }

  function updateSocio(i: number, field: 'nome' | 'percentual', value: string | number) {
    const updated = [...outrosSocios]
    updated[i] = { ...updated[i], [field]: value }
    onUpdate('outrosSocios', updated)
  }

  function removeSocio(i: number) {
    onUpdate('outrosSocios', outrosSocios.filter((_, idx) => idx !== i))
  }

  // Auto-infer empresa name on first render if name is absent or looks like raw IRPF text.
  // "Raw IRPF" heuristic: mostly uppercase, or contains structural keywords.
  useEffect(() => {
    if (hasAutoInferred.current) return
    const name = participacao.empresa ?? ''
    const hasData = !!(participacao.cnpj || participacao.percentual > 0 || (participacao.outrosSocios ?? []).length > 0)
    const uppercaseRatio = name.length > 0
      ? name.split('').filter(c => c >= 'A' && c <= 'Z').length / name.replace(/\s/g, '').length
      : 1
    const isRawIrpf = /PARTICIPAC[AÃ]O|CAPITAL SOCIAL|QUOTAS?|COTAS?\s|SOCIET[AÁ]R/i.test(name)
    const needsInference = name.length === 0 || isRawIrpf || (uppercaseRatio > 0.75 && name.length > 20)
    if (!needsInference || !hasData) return
    hasAutoInferred.current = true
    inferTitle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] bg-white">

      {/* Card header */}
      <div className="bg-olive-900 px-5 py-4">
        {/* Row 1: avatar + name (flex-1) + participação % (fixed narrow) */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          {/* Name takes all available space, stops before the % box */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input
                value={participacao.empresa}
                onChange={e => onUpdate('empresa', e.target.value)}
                placeholder="Nome da empresa"
                className="flex-1 min-w-0 text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-white/60 focus:outline-none pb-0.5 placeholder-white/40"
              />
              {/* ✦ Inferir — small icon-button next to the name */}
              <button
                onClick={inferTitle}
                disabled={inferring}
                title="Claude infere o melhor nome e resumo a partir dos dados disponíveis"
                className="flex-shrink-0 text-olive-300 hover:text-white disabled:opacity-40 transition-colors text-xs"
              >
                {inferring ? '…' : '✦'}
              </button>
            </div>
            <p className="text-xs font-mono text-olive-200 mt-0.5">
              {participacao.cnpj || 'CNPJ a preencher'}
            </p>
          </div>
          {/* Participation % — fixed narrow column */}
          <div className="text-right flex-shrink-0 pl-2">
            <p className="text-xs text-olive-200">Part.</p>
            <p className="text-base font-bold text-white leading-tight">
              {participacao.percentual > 0 ? `${participacao.percentual}%` : '—'}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {participacao.needsReview && (
            <span className="text-xs bg-olive-500/20 text-olive-300 px-2 py-0.5 rounded-full font-medium">revisar</span>
          )}
          {!anexos.some(a => a.status === 'enviado') && (
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium">sem contrato</span>
          )}
          {participacao.naturezaJuridica && (
            <span className="text-xs bg-white/10 text-olive-200 px-2 py-0.5 rounded-full font-medium">
              {participacao.naturezaJuridica}
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="bg-amber-50 px-5 py-4 space-y-3">

        {/* Flags */}
        {itemFlags.map((f, fi) => (
          <div key={fi} className={`text-xs px-3 py-2 rounded-lg border ${flagClasses(f.severity)}`}>
            {f.message}
          </div>
        ))}

        {/* Resumo — always visible once populated */}
        {participacao.resumo && (
          <div className="bg-white border border-olive-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-olive-700 uppercase tracking-wide mb-1">Resumo</p>
            <p className="text-sm text-gray-700 leading-relaxed">{participacao.resumo}</p>
          </div>
        )}

        {/* Key metrics strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-gray-400">Valor estimado</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {participacao.valorPatrimonial ? formatBRL(participacao.valorPatrimonial) : '—'}
            </p>
          </div>
          <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-gray-400">Outros sócios</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {outrosSocios.length > 0
                ? outrosSocios.slice(0, 1).map(s => `${s.nome || 'S/N'}`).join('') + (outrosSocios.length > 1 ? ` +${outrosSocios.length - 1}` : '')
                : '—'}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-xs text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1 py-2 border border-gray-100 rounded-lg hover:border-gray-300 transition-colors"
        >
          {expanded ? '▲ Recolher' : '▼ Editar detalhes'}
        </button>

        {/* Expanded edit form */}
        {expanded && (
          <div className="border-t border-gray-100 pt-4 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <EditField label="CNPJ" value={participacao.cnpj} onChange={v => onUpdate('cnpj', v)} placeholder="00.000.000/0001-00" mono />
              <EditField label="% Participação" value={String(participacao.percentual)} type="number" onChange={v => onUpdate('percentual', parseFloat(v) || 0)} />
              <EditField label="Natureza jurídica" value={participacao.naturezaJuridica ?? ''} onChange={v => onUpdate('naturezaJuridica', v)} placeholder="Ltda, S/A, EIRELI…" />
              <EditField label="Valor patrimonial (R$)" value={String(participacao.valorPatrimonial ?? '')} type="number" onChange={v => onUpdate('valorPatrimonial', parseFloat(v) || 0)} />
            </div>

            {/* Método de avaliação */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Método de avaliação</label>
              <select
                value={participacao.metodoAvaliacao ?? ''}
                onChange={e => onUpdate('metodoAvaliacao', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                <option value="">Selecione…</option>
                {METODOS_AVALIACAO.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Outros sócios */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">
                Outros sócios relevantes
              </label>
              <div className="space-y-2">
                {outrosSocios.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      value={s.nome}
                      onChange={e => updateSocio(i, 'nome', e.target.value)}
                      placeholder="Nome do sócio"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={s.percentual}
                        onChange={e => updateSocio(i, 'percentual', parseFloat(e.target.value) || 0)}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                    <button onClick={() => removeSocio(i)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <button
                onClick={addSocio}
                className="mt-2 text-xs text-gray-400 hover:text-gray-700 underline"
              >
                + Adicionar sócio
              </button>
            </div>

            {/* Resumo editável */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Resumo</label>
              <textarea
                value={participacao.resumo ?? ''}
                onChange={e => onUpdate('resumo', e.target.value)}
                placeholder="Resumo da participação societária…"
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none"
              />
            </div>

            {/* Contratos e Documentos */}
            <ContratosPanel
              docs={anexos}
              clientId={clientId}
              categoria={`participacao_${index}`}
              docType="participacao"
              existingData={existingData()}
              onUpdate={docs => onUpdateAnexos(docs as RecordAnexo[])}
              onInterpret={handleInterpret}
            />

            {/* Footer: reclassify + remove */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
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
                  <option value="credito">Crédito</option>
                  <option value="outro_bem">Outros Bens</option>
                </select>
              </div>
              <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">
                Remover participação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

export function ParticipacaoSection({ participacoes, flags, clientId, onChange, onReclassify }: Props) {
  const sectionFlags = flags.filter(f => f.section === 'participacoesSocietarias' && f.field === 'geral')

  function update(i: number, field: keyof ParticipacaoSocietaria, value: unknown) {
    const updated = [...participacoes]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  function updateAnexos(i: number, anexos: RecordAnexo[]) {
    const updated = [...participacoes]
    updated[i] = { ...updated[i], anexos }
    onChange(updated)
  }

  function merge(i: number, fields: Partial<ParticipacaoSocietaria>) {
    const updated = [...participacoes]
    updated[i] = { ...updated[i], ...fields }
    onChange(updated)
  }

  function remove(i: number) {
    onChange(participacoes.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...participacoes, {
      empresa: '',
      cnpj: '',
      percentual: 0,
      source: 'manual',
      needsReview: false,
    }])
  }

  const totalValor = participacoes.reduce((s, p) => s + (p.valorPatrimonial ?? 0), 0)

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-base font-semibold text-gray-900">Participações em Empresas Privadas</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {participacoes.length} {participacoes.length === 1 ? 'empresa' : 'empresas'}
          {totalValor > 0 && ` · Valor total estimado: `}
          {totalValor > 0 && <strong className="text-gray-700">{formatBRL(totalValor)}</strong>}
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Ações em bolsa, FIIs e fundos de investimento são exibidos em Ativos Financeiros.
        </p>
      </div>

      {sectionFlags.map((f, i) => (
        <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${flagClasses(f.severity)}`}>{f.message}</div>
      ))}

      {participacoes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {participacoes.map((p, i) => (
            <ParticipacaoCard
              key={i}
              participacao={p}
              index={i}
              flags={flags}
              clientId={clientId}
              onUpdate={(field, value) => update(i, field, value)}
              onUpdateAnexos={(anexos) => updateAnexos(i, anexos)}
              onRemove={() => remove(i)}
              onReclassify={onReclassify ? (d) => onReclassify(i, d) : undefined}
              onMerge={(fields) => merge(i, fields)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">
          Nenhuma participação em empresa privada registrada.
        </div>
      )}

      <button
        onClick={add}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Adicionar participação societária
      </button>
    </div>
  )
}
