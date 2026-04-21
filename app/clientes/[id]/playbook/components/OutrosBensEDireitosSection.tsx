'use client'

import { useState } from 'react'
import { OutroBemItem, OutroBemEDireitoRecord, ClassificacaoAdvisor } from '@/lib/types/playbook'
import { formatBRL } from './utils'

// ── Classification options ────────────────────────────────────────────────────

const CLASSIFICACAO_OPTIONS: { value: ClassificacaoAdvisor; label: string }[] = [
  { value: 'outro_bem',        label: 'Outros Bens e Direitos' },
  { value: 'skip',             label: 'Ignorar' },
  { value: 'ativo_financeiro', label: 'Ativo Financeiro' },
  { value: 'imovel',           label: 'Imóvel' },
  { value: 'participacao',     label: 'Participação' },
  { value: 'credito',          label: 'Crédito' },
]

const GRUPO_LABELS: Record<string, string> = {
  '02': 'Bens Móveis',
  '99': 'Outros',
}

function grupoLabel(grupo: string): string {
  return GRUPO_LABELS[grupo.padStart(2, '0')] ?? `Grupo ${grupo}`
}

// ── Pending item row (classification UI) ──────────────────────────────────────

function PendingItemRow({
  item,
  onUpdate,
}: {
  item: OutroBemItem
  onUpdate: (updated: OutroBemItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const current = item.classificacaoAdvisor ?? 'outro_bem'

  return (
    <>
      <div className="grid grid-cols-[1fr_140px_120px_32px] items-center gap-3 px-4 py-2.5 hover:bg-amber-100/60 transition-colors">
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.discriminacao}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs mr-2">
              {grupoLabel(item.grupo)}
            </span>
            {item.source === 'pdf' && (
              <span className="text-orange-400">PDF — revisar</span>
            )}
          </p>
        </div>

        <span className="text-sm font-medium text-gray-700 tabular-nums text-right">
          {formatBRL(item.situacaoAtual)}
        </span>

        <select
          value={current}
          onChange={e => onUpdate({ ...item, classificacaoAdvisor: e.target.value as ClassificacaoAdvisor })}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white w-full"
        >
          {CLASSIFICACAO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-300 hover:text-gray-600 text-xs px-1"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100">
          <div className="pt-3">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nota do assessor</label>
            <textarea
              value={item.notaAdvisor ?? ''}
              onChange={e => onUpdate({ ...item, notaAdvisor: e.target.value })}
              placeholder="Observação interna — ex.: carro de uso pessoal, joia herdada, etc."
              rows={2}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white"
            />
          </div>
        </div>
      )}
    </>
  )
}

// ── Confirmed item row (outrosBensEDireitos) ──────────────────────────────────

const MOVER_PARA_OPTIONS: { value: ClassificacaoAdvisor; label: string }[] = [
  { value: 'outro_bem',        label: 'Outros Bens e Direitos' },
  { value: 'ativo_financeiro', label: 'Ativo Financeiro' },
  { value: 'imovel',           label: 'Imóvel' },
  { value: 'participacao',     label: 'Participação Societária' },
  { value: 'credito',          label: 'Crédito / Direito a Receber' },
]

function ConfirmedItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: OutroBemEDireitoRecord
  onUpdate: (updated: OutroBemEDireitoRecord) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const destino = item.classificacaoAdvisor ?? 'outro_bem'
  const isPendingMove = destino !== 'outro_bem'

  return (
    <>
      <div className={`grid grid-cols-[1fr_140px_32px] items-center gap-3 px-4 py-2.5 transition-colors ${isPendingMove ? 'bg-amber-100/80' : 'hover:bg-amber-100/60'}`}>
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.descricao}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {grupoLabel(item.grupo)}
            </span>
            {item.needsReview && (
              <span className="text-xs text-orange-400">PDF — revisar</span>
            )}
            {isPendingMove && (
              <span className="text-xs text-amber-700 font-medium">
                → {MOVER_PARA_OPTIONS.find(o => o.value === destino)?.label}
              </span>
            )}
            {!isPendingMove && item.nota && (
              <span className="text-xs text-gray-400 truncate">{item.nota}</span>
            )}
          </div>
        </div>

        <span className="text-sm font-medium text-gray-700 tabular-nums text-right">
          {formatBRL(item.valor)}
        </span>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-300 hover:text-gray-600 text-xs px-1"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100 space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
              <input
                type="text"
                value={item.descricao}
                onChange={e => onUpdate({ ...item, descricao: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Mover para outra seção</label>
              <select
                value={destino}
                onChange={e => onUpdate({ ...item, classificacaoAdvisor: e.target.value as ClassificacaoAdvisor })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
              >
                {MOVER_PARA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {isPendingMove && (
                <p className="text-xs text-amber-700 mt-0.5">Salve e clique em Reprocessar para aplicar a mudança de seção.</p>
              )}
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nota</label>
              <textarea
                value={item.nota ?? ''}
                onChange={e => onUpdate({ ...item, nota: e.target.value })}
                placeholder="Observação — ex.: veículo de uso pessoal, item de herança, etc."
                rows={2}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  outrosBens: OutroBemItem[]
  outrosBensEDireitos: OutroBemEDireitoRecord[]
  onPendingChange: (items: OutroBemItem[]) => void
  onChange: (items: OutroBemEDireitoRecord[]) => void
  onReprocessar?: () => Promise<void>
  regenerating?: boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export function OutrosBensEDireitosSection({
  outrosBens,
  outrosBensEDireitos,
  onPendingChange,
  onChange,
  onReprocessar,
  regenerating,
}: Props) {
  const totalConfirmado = outrosBensEDireitos.reduce((s, i) => s + i.valor, 0)
  const pendingCount = outrosBens.length   // legacy backward-compat
  const classifiedCount = outrosBens.filter(i => i.classificacaoAdvisor && i.classificacaoAdvisor !== 'skip').length
  const hasLegacyClassifications = classifiedCount > 0

  // Items in the confirmed section that the advisor wants to move to another section
  const pendingMoveCount = outrosBensEDireitos.filter(
    i => i.classificacaoAdvisor && i.classificacaoAdvisor !== 'outro_bem'
  ).length
  const hasPendingMoves = pendingMoveCount > 0

  function updatePending(index: number, updated: OutroBemItem) {
    const next = [...outrosBens]
    next[index] = updated
    onPendingChange(next)
  }

  function updateConfirmed(index: number, updated: OutroBemEDireitoRecord) {
    const next = [...outrosBensEDireitos]
    next[index] = updated
    onChange(next)
  }

  function removeConfirmed(index: number) {
    onChange(outrosBensEDireitos.filter((_, i) => i !== index))
  }

  function addManual() {
    onChange([...outrosBensEDireitos, {
      descricao: '',
      grupo: '99',
      codigo: '99',
      valor: 0,
      source: 'manual',
      needsReview: false,
    }])
  }

  return (
    <div className="space-y-5">

      {/* Pending moves banner */}
      {hasPendingMoves && (
        <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-amber-600 text-sm mt-0.5">↺</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {pendingMoveCount} {pendingMoveCount === 1 ? 'item marcado' : 'itens marcados'} para mover — salve e clique em Reprocessar para aplicar
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Itens serão movidos para suas respectivas seções e removidos daqui.
            </p>
          </div>
        </div>
      )}

      {/* Confirmed section */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Outros Bens e Direitos</h3>
            <p className="text-xs text-olive-200 mt-0.5">
              {outrosBensEDireitos.length > 0
                ? `${outrosBensEDireitos.length} ${outrosBensEDireitos.length === 1 ? 'item' : 'itens'} · ${formatBRL(totalConfirmado)}`
                : 'Itens do Grupo 02 e 99 do IRPF — expanda para reclassificar'}
            </p>
          </div>
        </div>
        <div className="bg-amber-50">
          {outrosBensEDireitos.length > 0 && (
            <>
              <div className="grid grid-cols-[1fr_140px_32px] gap-3 px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Descrição</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Valor declarado</span>
                <div />
              </div>
              <div className="divide-y divide-gray-100">
                {outrosBensEDireitos.map((item, i) => (
                  <ConfirmedItemRow
                    key={i}
                    item={item}
                    onUpdate={updated => updateConfirmed(i, updated)}
                    onRemove={() => removeConfirmed(i)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-5 py-3">
            <button
              onClick={addManual}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              + Adicionar item manualmente
            </button>
          </div>
        </div>
      </div>

      {/* Reprocessar button — shown when any items are marked to move */}
      {(hasPendingMoves || hasLegacyClassifications) && onReprocessar && (
        <div className="flex justify-end">
          <button
            onClick={onReprocessar}
            disabled={regenerating}
            className="px-4 py-2 text-sm font-medium bg-olive-900 text-white rounded-lg hover:bg-olive-800 disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Reprocessando…' : '↺ Reprocessar — aplicar movimentações'}
          </button>
        </div>
      )}

      {/* Legacy: pending items card — backward compat for old playbooks */}
      {pendingCount > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="bg-olive-900 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Itens pendentes (legado)</h3>
            <p className="text-xs text-olive-200 mt-0.5">
              {pendingCount} {pendingCount === 1 ? 'item' : 'itens'} do IRPF anterior · Reprocessar para migrar
            </p>
          </div>
          <div className="bg-amber-50">
            <div className="grid grid-cols-[1fr_140px_120px_32px] gap-3 px-4 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Discriminação</span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Valor</span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Classificação</span>
              <div />
            </div>
            <div className="divide-y divide-gray-100">
              {outrosBens.map((item, i) => (
                <PendingItemRow
                  key={i}
                  item={item}
                  onUpdate={updated => updatePending(i, updated)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {pendingCount === 0 && outrosBensEDireitos.length === 0 && (
        <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="bg-olive-900 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Outros Bens e Direitos</h3>
          </div>
          <div className="bg-amber-50 px-5 py-8 text-center">
            <p className="text-sm text-gray-400">Nenhum item nesta seção.</p>
            <p className="text-xs text-gray-300 mt-1">Itens do Grupo 02 e 99 do IRPF aparecem aqui automaticamente.</p>
          </div>
        </div>
      )}
    </div>
  )
}
