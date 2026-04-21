'use client'

import { useState } from 'react'
import { ImovelRecord, ReviewFlag, RecordAnexo, DeedCheckData, DestinoReclassificacao } from '@/lib/types/playbook'
import { formatBRL, flagClasses } from './utils'
import { AnexoButton } from './AnexoButton'

interface Props {
  imoveis: ImovelRecord[]
  flags: ReviewFlag[]
  clientId: string
  onChange: (items: ImovelRecord[]) => void
  onReclassify?: (index: number, destino: DestinoReclassificacao) => void
}

// ── DeedCheck sub-component ───────────────────────────────────────────────────

function DeedCheckPanel({
  imovel,
  clientId,
  onUpdate,
}: {
  imovel: ImovelRecord
  clientId: string
  onUpdate: (deedCheck: DeedCheckData) => void
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const dc = imovel.deedCheck
  const matriculaAnexo = (imovel.anexos ?? []).find(
    a => a.status === 'enviado' && a.storagePath
  )

  async function runCheck() {
    if (!matriculaAnexo?.storagePath) return
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/imoveis/deed-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: matriculaAnexo.storagePath,
          imovelData: imovel,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Erro na verificação')
        return
      }
      const result: DeedCheckData = await res.json()
      onUpdate(result)
    } catch {
      setError('Falha na conexão')
    } finally {
      setRunning(false)
    }
  }

  const statusConfig = {
    nao_verificado: { label: 'Não verificado', color: 'bg-gray-100 text-gray-500' },
    ok:             { label: 'Matrícula ok',    color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    divergencia:    { label: 'Divergência',     color: 'bg-red-50 text-red-700 border border-red-200' },
    parcial:        { label: 'Atenção',         color: 'bg-amber-50 text-olive-700 border border-olive-200' },
  }

  const cfg = statusConfig[dc?.status ?? 'nao_verificado']

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Verificação de Matrícula</span>
          {dc && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
          )}
        </div>
        <button
          onClick={runCheck}
          disabled={running || !matriculaAnexo}
          title={!matriculaAnexo ? 'Anexe a matrícula PDF primeiro' : 'Verificar via IA'}
          className="text-xs px-3 py-1.5 rounded-lg border border-olive-300 text-olive-800 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running ? 'Verificando…' : dc ? 'Re-verificar' : 'Verificar matrícula'}
        </button>
      </div>

      {!matriculaAnexo && (
        <p className="text-xs text-gray-300 italic">
          Anexe o PDF da matrícula acima para habilitar a verificação automática.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {dc && dc.status !== 'nao_verificado' && (
        <div className="space-y-2">
          {/* Extracted fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {[
              { label: 'Nº Matrícula',   val: dc.numeroMatricula },
              { label: 'Proprietário',   val: dc.proprietarioRegistrado },
              { label: 'Área registrada', val: dc.areaRegistrada },
              { label: 'Data aquisição', val: dc.dataAquisicao },
              { label: 'Cartório',       val: dc.cartorioRegistrado },
              { label: 'Ônus',           val: dc.onus },
            ].map(({ label, val }) => val ? (
              <div key={label} className="flex flex-col">
                <span className="text-gray-400 uppercase tracking-wide" style={{ fontSize: '10px' }}>{label}</span>
                <span className="text-gray-700 font-medium">{val}</span>
              </div>
            ) : null)}
            {dc.valorAquisicaoRegistrado && (
              <div className="flex flex-col">
                <span className="text-gray-400 uppercase tracking-wide" style={{ fontSize: '10px' }}>Valor registrado</span>
                <span className="text-gray-700 font-medium">{formatBRL(dc.valorAquisicaoRegistrado)}</span>
              </div>
            )}
          </div>

          {/* Flags */}
          {(dc.flags ?? []).length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              {dc.flags!.map((f, i) => (
                <div
                  key={i}
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    f.severidade === 'required'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-olive-200 text-olive-700'
                  }`}
                >
                  <span className="font-medium capitalize">{f.campo}: </span>
                  IRPF <span className="font-mono">{f.irpf}</span>
                  {' · '}
                  Matrícula <span className="font-mono">{f.matricula}</span>
                </div>
              ))}
            </div>
          )}

          {dc.verificadoEm && (
            <p className="text-xs text-gray-300">
              Verificado em {new Date(dc.verificadoEm).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Address helpers ───────────────────────────────────────────────────────────

// Extract "Logradouro, Número" — first two comma-separated segments of the address.
function extractLogradouro(endereco?: string): string {
  if (!endereco) return 'Endereço não informado'
  const parts = endereco.split(',')
  const result = parts.slice(0, 2).join(',').trim()
  return result.length > 60 ? result.slice(0, 57) + '…' : result
}

// ── ImovelCard ────────────────────────────────────────────────────────────────

function ImovelCard({
  imovel,
  index,
  flags,
  clientId,
  onUpdate,
  onUpdateAnexos,
  onUpdateDeedCheck,
  onRemove,
  onReclassify,
}: {
  imovel: ImovelRecord
  index: number
  flags: ReviewFlag[]
  clientId: string
  onUpdate: (field: keyof ImovelRecord, value: string | number | boolean) => void
  onUpdateAnexos: (anexos: RecordAnexo[]) => void
  onUpdateDeedCheck: (dc: DeedCheckData) => void
  onRemove: () => void
  onReclassify?: (destino: DestinoReclassificacao) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const itemFlags = flags.filter(f => f.field.startsWith(`imoveis[${index}]`))

  // Icon initials — from logradouro (first word) or fallback
  const logradouro = extractLogradouro(imovel.endereco)
  const initials = logradouro
    .split(/[\s,]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'IM'

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] bg-white">

      {/* Card header */}
      <div className="bg-olive-900 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              {/* Title = logradouro + número */}
              <p className="text-sm font-semibold text-white truncate">
                {logradouro}
              </p>
              {/* Subtitle = IRPF description (tipo do imóvel) */}
              <p className="text-xs text-olive-200 truncate mt-0.5">
                {imovel.descricao || 'Sem descrição'}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-olive-200">Valor declarado</p>
            <p className="text-sm font-bold text-white">{formatBRL(imovel.valorDeclarado)}</p>
          </div>
        </div>

        {/* Badges + paperclip row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {imovel.source === 'dec' && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">.DEC</span>
            )}
            {imovel.needsReview && (
              <span className="text-xs bg-olive-500/20 text-olive-300 px-2 py-0.5 rounded-full font-medium">revisar</span>
            )}
            {imovel.deedCheck?.status === 'divergencia' && (
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium">⚠ divergência</span>
            )}
            {imovel.deedCheck?.status === 'ok' && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">✓ matrícula ok</span>
            )}
            {imovel.percentualPropriedade !== undefined && imovel.percentualPropriedade < 100 && (
              <span className="text-xs bg-white/10 text-olive-200 px-2 py-0.5 rounded-full font-medium">
                {imovel.percentualPropriedade}% propriedade
              </span>
            )}
          </div>
          <AnexoButton
            anexos={imovel.anexos ?? []}
            clientId={clientId}
            categoria={`imovel_${index}`}
            onUpdate={onUpdateAnexos}
          />
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

        {/* Matricula badge */}
        {imovel.matricula ? (
          <div className="text-xs text-gray-500 bg-amber-50 px-3 py-1.5 rounded-lg">
            Matrícula: <span className="font-mono font-medium">{imovel.matricula}</span>
            {imovel.cartorio && <span className="text-gray-400"> · {imovel.cartorio}</span>}
          </div>
        ) : (
          <div className="text-xs text-gray-300 bg-amber-50 px-3 py-1.5 rounded-lg italic">
            Matrícula: a preencher
          </div>
        )}

        {/* DeedCheck panel — always visible */}
        <DeedCheckPanel
          imovel={imovel}
          clientId={clientId}
          onUpdate={onUpdateDeedCheck}
        />

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-xs text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-amber-50 transition-colors border border-gray-100"
        >
          {expanded ? '▲ Recolher' : '▼ Editar detalhes'}
        </button>

        {/* Expanded edit fields */}
        {expanded && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <EditField label="Descrição" value={imovel.descricao} onChange={v => onUpdate('descricao', v)} />
            <EditField label="Endereço" value={imovel.endereco ?? ''} onChange={v => onUpdate('endereco', v)} />
            <EditField label="Matrícula" value={imovel.matricula ?? ''} onChange={v => onUpdate('matricula', v)} placeholder="Nº de matrícula" />
            <EditField label="Cartório" value={imovel.cartorio ?? ''} onChange={v => onUpdate('cartorio', v)} />
            <EditField label="Área total" value={imovel.areaTotal ?? ''} onChange={v => onUpdate('areaTotal', v)} placeholder="ex: 120m²" />
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Valor (R$)" value={String(imovel.valorDeclarado)} type="number" onChange={v => onUpdate('valorDeclarado', parseFloat(v) || 0)} />
              <EditField label="% Propriedade" value={String(imovel.percentualPropriedade ?? 100)} type="number" onChange={v => onUpdate('percentualPropriedade', parseFloat(v) || 100)} />
            </div>
            <EditField label="Observações" value={imovel.observacoes ?? ''} onChange={v => onUpdate('observacoes', v)} />
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
                  <option value="ativo_financeiro">Ativos Financeiros</option>
                  <option value="participacao">Participação Societária</option>
                  <option value="credito">Crédito</option>
                  <option value="outro_bem">Outros Bens</option>
                </select>
              </div>
              <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">
                Remover imóvel
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
      />
    </div>
  )
}

export function ImoveisSection({ imoveis, flags, clientId, onChange, onReclassify }: Props) {
  const sectionFlags = flags.filter(f => f.section === 'imoveis' && f.field === 'geral')

  function update(i: number, field: keyof ImovelRecord, value: string | number | boolean) {
    const updated = [...imoveis]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  function updateAnexos(i: number, anexos: RecordAnexo[]) {
    const updated = [...imoveis]
    updated[i] = { ...updated[i], anexos }
    onChange(updated)
  }

  function updateDeedCheck(i: number, deedCheck: DeedCheckData) {
    const updated = [...imoveis]
    updated[i] = { ...updated[i], deedCheck }
    onChange(updated)
  }

  function remove(i: number) {
    onChange(imoveis.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...imoveis, {
      descricao: '',
      valorDeclarado: 0,
      source: 'manual',
      needsReview: false,
    }])
  }

  const totalImoveis = imoveis.reduce((s, im) => s + im.valorDeclarado, 0)

  return (
    <div className="space-y-6">

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Imóveis</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {imoveis.length} {imoveis.length === 1 ? 'imóvel' : 'imóveis'} · Total declarado:{' '}
            <strong className="text-gray-700">{formatBRL(totalImoveis)}</strong>
          </p>
        </div>
      </div>

      {/* Global flags */}
      {sectionFlags.map((f, i) => (
        <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${flagClasses(f.severity)}`}>{f.message}</div>
      ))}

      {/* Card grid */}
      {imoveis.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {imoveis.map((im, i) => (
            <ImovelCard
              key={i}
              imovel={im}
              index={i}
              flags={flags}
              clientId={clientId}
              onUpdate={(field, value) => update(i, field, value)}
              onUpdateAnexos={(anexos) => updateAnexos(i, anexos)}
              onUpdateDeedCheck={(dc) => updateDeedCheck(i, dc)}
              onRemove={() => remove(i)}
              onReclassify={onReclassify ? (d) => onReclassify(i, d) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">
          Nenhum imóvel registrado.
        </div>
      )}

      {/* Add button */}
      <button
        onClick={add}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Adicionar imóvel
      </button>
    </div>
  )
}
