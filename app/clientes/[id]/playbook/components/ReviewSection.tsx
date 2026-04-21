'use client'

import { useState, useCallback } from 'react'
import { PlaybookData, AdvisorReviewItem, AdvisorReviewStatus } from '@/lib/types/playbook'
import { runAdvisorReview } from '@/lib/review/runAdvisorReview'

interface Props {
  data: PlaybookData
  onUpdateReview: (items: AdvisorReviewItem[]) => void
}

// ── Status controls ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: AdvisorReviewStatus; label: string; color: string }[] = [
  { value: 'pendente',       label: 'Pendente',      color: 'bg-gray-100 text-gray-600' },
  { value: 'ok',             label: 'OK ✓',          color: 'bg-emerald-100 text-emerald-700' },
  { value: 'nao_aplicavel',  label: 'N/A',           color: 'bg-gray-50 text-gray-400' },
]

function statusCycle(current: AdvisorReviewStatus): AdvisorReviewStatus {
  const order: AdvisorReviewStatus[] = ['pendente', 'ok', 'nao_aplicavel']
  const idx = order.indexOf(current)
  return order[(idx + 1) % order.length]
}

function statusConfig(s: AdvisorReviewStatus) {
  return STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0]
}

// ── ReviewItem row ────────────────────────────────────────────────────────────

function ReviewRow({
  item,
  onStatusChange,
  onNotaChange,
}: {
  item: AdvisorReviewItem
  onStatusChange: (id: string, status: AdvisorReviewStatus) => void
  onNotaChange: (id: string, nota: string) => void
}) {
  const [editingNota, setEditingNota] = useState(false)
  const cfg = statusConfig(item.status)
  const isAuto = item.id.startsWith('auto_')

  return (
    <div className={`py-3.5 border-b border-gray-50 last:border-0 ${item.status === 'nao_aplicavel' ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={() => onStatusChange(item.id, statusCycle(item.status))}
          className={`flex-shrink-0 mt-0.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${cfg.color}`}
          title="Clique para alterar status"
        >
          {cfg.label}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isAuto && (
              <span className="text-xs bg-olive-100 text-olive-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                Auto
              </span>
            )}
            <p className={`text-sm ${item.status === 'ok' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {item.descricao}
            </p>
          </div>

          {/* Auto-detail */}
          {item.autoDetalhe && (
            <p className="text-xs text-olive-700 mt-0.5 font-mono">{item.autoDetalhe}</p>
          )}

          {/* Nota */}
          {editingNota ? (
            <div className="mt-2">
              <input
                autoFocus
                type="text"
                value={item.nota ?? ''}
                onChange={e => onNotaChange(item.id, e.target.value)}
                onBlur={() => setEditingNota(false)}
                placeholder="Nota do assessor…"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
              />
            </div>
          ) : (
            <button
              onClick={() => setEditingNota(true)}
              className="mt-1 text-xs text-gray-300 hover:text-gray-500"
            >
              {item.nota ? `📝 ${item.nota}` : '+ nota'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Category block ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<AdvisorReviewItem['categoria'], string> = {
  completude:   'Completude',
  consistencia: 'Consistência',
  qualidade:    'Qualidade',
}

function CategoryBlock({
  categoria,
  items,
  onStatusChange,
  onNotaChange,
}: {
  categoria: AdvisorReviewItem['categoria']
  items: AdvisorReviewItem[]
  onStatusChange: (id: string, status: AdvisorReviewStatus) => void
  onNotaChange: (id: string, nota: string) => void
}) {
  const done = items.filter(i => i.status === 'ok' || i.status === 'nao_aplicavel').length
  const total = items.length

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{CATEGORY_LABELS[categoria]}</h3>
          <p className="text-xs text-olive-200 mt-0.5">{done} de {total} resolvidos</p>
        </div>
        <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${total > 0 ? Math.round(done / total * 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="bg-amber-50 px-5 py-1">
        {items.map(item => (
          <ReviewRow
            key={item.id}
            item={item}
            onStatusChange={onStatusChange}
            onNotaChange={onNotaChange}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export function ReviewSection({ data, onUpdateReview }: Props) {
  const [items, setItems] = useState<AdvisorReviewItem[]>(() =>
    runAdvisorReview(data, data.advisorReview ?? [])
  )
  const [refreshing, setRefreshing] = useState(false)

  const handleStatusChange = useCallback((id: string, status: AdvisorReviewStatus) => {
    const updated = items.map(i => i.id === id ? { ...i, status } : i)
    setItems(updated)
    onUpdateReview(updated)
  }, [items, onUpdateReview])

  const handleNotaChange = useCallback((id: string, nota: string) => {
    const updated = items.map(i => i.id === id ? { ...i, nota } : i)
    setItems(updated)
    onUpdateReview(updated)
  }, [items, onUpdateReview])

  function refresh() {
    setRefreshing(true)
    const updated = runAdvisorReview(data, items)
    setItems(updated)
    onUpdateReview(updated)
    setTimeout(() => setRefreshing(false), 600)
  }

  const categories: AdvisorReviewItem['categoria'][] = ['completude', 'consistencia', 'qualidade']

  const autoItems   = items.filter(i => i.id.startsWith('auto_'))
  const pendingAuto = autoItems.filter(i => i.status === 'pendente').length
  const totalOk     = items.filter(i => i.status === 'ok' || i.status === 'nao_aplicavel').length
  const total       = items.length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Revisão do Assessor</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalOk} de {total} itens resolvidos
            {pendingAuto > 0 && (
              <span className="ml-2 text-xs bg-olive-100 text-olive-700 px-2 py-0.5 rounded-full font-medium">
                {pendingAuto} {pendingAuto === 1 ? 'problema detectado' : 'problemas detectados'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {refreshing ? 'Atualizando…' : '↻ Re-validar'}
        </button>
      </div>

      {/* Auto-detected issues — shown at top if any */}
      {autoItems.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Problemas Detectados Automaticamente</h3>
              <p className="text-xs text-olive-200 mt-0.5">
                {pendingAuto > 0 ? `${pendingAuto} pendente(s)` : 'Todos resolvidos'}
              </p>
            </div>
            {pendingAuto === 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-medium">
                ✓ Limpo
              </span>
            )}
          </div>
          <div className="bg-amber-50 px-5 py-1">
            {autoItems.map(item => (
              <ReviewRow
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                onNotaChange={handleNotaChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manual checklist by category */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.categoria === cat && !i.id.startsWith('auto_'))
        if (catItems.length === 0) return null
        return (
          <CategoryBlock
            key={cat}
            categoria={cat}
            items={catItems}
            onStatusChange={handleStatusChange}
            onNotaChange={handleNotaChange}
          />
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 px-1">
        <span>Clique no status para alternar:</span>
        {STATUS_OPTIONS.map(o => (
          <span key={o.value} className={`px-2 py-0.5 rounded-full font-medium ${o.color}`}>
            {o.label}
          </span>
        ))}
      </div>
    </div>
  )
}
