'use client'

import { useState } from 'react'
import { PDFSection } from '@/lib/pdf/types'
import { PlaybookData } from '@/lib/types/playbook'

interface Props {
  playbookId: string
  playbookData?: PlaybookData   // current UI state — if provided, PDF reflects unsaved edits
  onClose: () => void
}

type SectionOption = {
  id: PDFSection
  label: string
  description: string
}

const SECTION_OPTIONS: SectionOption[] = [
  { id: 'dadosPessoais',            label: 'Dados Pessoais',              description: 'Identificação, contatos, dependentes, relações importantes' },
  { id: 'briefing',                 label: 'Briefing do Cliente',         description: 'Intenções de partilha, tutores, conselheiros, diretrizes' },
  { id: 'patrimonio',               label: 'Visão Geral do Patrimônio',   description: 'Consolidado por classe de ativo com valores declarados' },
  { id: 'imoveis',                  label: 'Imóveis',                     description: 'Inventário de bens imóveis com matrícula e valores' },
  { id: 'ativosFinanceiros',        label: 'Ativos Financeiros',          description: 'Portfólio por instituição custodiante' },
  { id: 'creditos',                 label: 'Crédito Privado',             description: 'Operações de crédito estruturado contra PF e PJ' },
  { id: 'participacoesSocietarias', label: 'Participações Societárias',   description: 'Empresas privadas (LTDA / S.A. fechada)' },
  { id: 'documentos',               label: 'Documentos Vitais',           description: 'Status de entrega dos documentos sucessórios' },
]

export function ExportModal({ playbookId, playbookData, onClose }: Props) {
  const [selected, setSelected] = useState<Set<PDFSection>>(
    new Set(SECTION_OPTIONS.map(s => s.id))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: PDFSection) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === SECTION_OPTIONS.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(SECTION_OPTIONS.map(s => s.id)))
    }
  }

  async function generate() {
    if (selected.size === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/playbook/${playbookId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: Array.from(selected),
          ...(playbookData ? { playbookData } : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Falha na geração do PDF')
        return
      }

      // Trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disp = res.headers.get('Content-Disposition') ?? ''
      const match = disp.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? 'testament.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onClose()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Backdrop — overflow-hidden prevents background page scroll */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-hidden"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal panel — flex-col + max-h keeps header/footer fixed, list scrolls */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header — fixed */}
        <div className="bg-olive-900 px-6 py-5 sm:rounded-t-2xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Exportar PDF</h2>
              <p className="text-xs text-olive-200 mt-0.5">Selecione as seções a incluir no documento</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Section list — scrollable, takes remaining space */}
        <div className="bg-amber-50 px-6 py-4 space-y-1 overflow-y-auto overscroll-contain flex-1">

          {/* Select all toggle */}
          <button
            onClick={toggleAll}
            className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-100 transition-colors mb-2"
          >
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {selected.size === SECTION_OPTIONS.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </span>
            <span className="text-xs text-gray-400">{selected.size}/{SECTION_OPTIONS.length}</span>
          </button>

          {SECTION_OPTIONS.map(opt => {
            const checked = selected.has(opt.id)
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 cursor-pointer py-3 px-3 rounded-xl transition-colors ${
                  checked ? 'bg-white shadow-sm' : 'hover:bg-gray-100'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  checked ? 'bg-olive-900 border-olive-900' : 'border-gray-300'
                }`}>
                  {checked && <span className="text-white text-xs leading-none">✓</span>}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  className="sr-only"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer — fixed at bottom */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 sm:rounded-b-2xl">
          {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
          {!error && (
            <p className="text-xs text-gray-400 flex-1">
              {selected.size === 0 ? 'Selecione ao menos uma seção' : `${selected.size} ${selected.size === 1 ? 'seção' : 'seções'} selecionadas`}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-amber-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={generate}
              disabled={loading || selected.size === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-olive-900 rounded-xl hover:bg-olive-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
