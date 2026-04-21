'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PlaybookData, DestinoReclassificacao } from '@/lib/types/playbook'
import { BriefingSection } from './components/BriefingSection'
import { DadosPessoaisSection } from './components/DadosPessoaisSection'
import { ImoveisSection } from './components/ImoveisSection'
import { AtivosSection } from './components/AtivosSection'
import { ParticipacaoSection } from './components/ParticipacaoSection'
import { CreditoSection } from './components/CreditoSection'
import { DocumentosSection } from './components/DocumentosSection'
import { ReviewSection } from './components/ReviewSection'
import { ExportModal } from './components/ExportModal'
import { OutrosBensEDireitosSection } from './components/OutrosBensEDireitosSection'
import { formatBRL } from './components/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlaybookRow {
  id: string
  status: string
  client_id: string
  playbook_data: PlaybookData
  updated_at?: string
}

type Section =
  | 'briefing'
  | 'dadosPessoais'
  | 'imoveis'
  | 'ativosFinanceiros'
  | 'creditos'
  | 'participacoesSocietarias'
  | 'outrosBensEDireitos'
  | 'documentos'
  | 'revisao'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft:     'Rascunho',
    in_review: 'Em revisão',
    approved:  'Aprovado',
    delivered: 'Entregue',
  }
  return map[s] ?? s
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    in_review: 'bg-olive-100 text-olive-700',
    approved:  'bg-green-100 text-green-700',
    delivered: 'bg-blue-100 text-blue-700',
  }
  return map[s] ?? 'bg-gray-100 text-gray-500'
}

// ── Tab component ─────────────────────────────────────────────────────────────

function Tab({
  id, label, active, flagCount, onClick,
}: {
  id: Section; label: string; active: boolean; flagCount: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        active ? 'bg-olive-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      {flagCount > 0 && (
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${
          active ? 'bg-white text-olive-900' : 'bg-olive-100 text-olive-700'
        }`}>
          {flagCount}
        </span>
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlaybookPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [playbook, setPlaybook] = useState<PlaybookRow | null>(null)
  const [localData, setLocalData] = useState<PlaybookData | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('briefing')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [reclassifyToast, setReclassifyToast] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [regenResult, setRegenResult] = useState('')
  const [showReupload, setShowReupload] = useState(false)
  const [reuploadFile, setReuploadFile] = useState<File | null>(null)
  const [reuploadYear, setReuploadYear] = useState(() => new Date().getFullYear() - 1)
  const [reuploading, setReuploading] = useState(false)
  const [reuploadError, setReuploadError] = useState('')
  const reuploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/playbook?clientId=${clientId}`)
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error('Erro ao carregar playbook')
        const row: PlaybookRow = await res.json()
        setPlaybook(row)
        setLocalData(row.playbook_data)
      } catch (err) {
        console.error(err)
        setSaveError('Erro ao carregar playbook')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  const save = useCallback(async (dataOverride?: PlaybookData) => {
    if (!playbook || !localData) return
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/playbook/${playbook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataOverride ?? localData }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error || 'Erro ao salvar')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }, [playbook, localData])

  async function advanceStatus(newStatus: string) {
    if (!playbook) return
    setSaving(true)
    setSaveError('')
    try {
      await save()
      const res = await fetch(`/api/playbook/${playbook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error || 'Erro ao atualizar status')
        return
      }
      const updated = await res.json()
      setPlaybook(p => p ? { ...p, status: updated.status } : p)
    } finally {
      setSaving(false)
    }
  }

  async function reprocessarIRPF(skipReextract = false) {
    if (!playbook) return
    setRegenerating(true)
    setRegenResult('')
    try {
      const url = `/api/playbook/${playbook.id}/regenerate${skipReextract ? '?reextract=false' : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRegenResult(json.error || 'Erro ao reprocessar')
        return
      }
      // Reload playbook data from server
      const reload = await fetch(`/api/playbook?clientId=${clientId}`)
      if (reload.ok) {
        const row: PlaybookRow = await reload.json()
        setPlaybook(row)
        setLocalData(row.playbook_data)
      }
      const label = json.reextracted
        ? `PDF reextraído — IRPF ${json.irpfYear}${json.reconciliation ? ` · declarado ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(json.reconciliation.totalDeclarado)} / extraído ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(json.reconciliation.totalExtracted)}` : ''}`
        : `Reclassificado — IRPF ${json.irpfYear}`
      setRegenResult(label)
      setTimeout(() => setRegenResult(''), 8000)
    } catch {
      setRegenResult('Erro inesperado')
    } finally {
      setRegenerating(false)
    }
  }

  // ── Cross-section reclassification ──────────────────────────────────────────

  type ReclassifySource = 'imovel' | 'ativo_financeiro' | 'participacao' | 'credito'

  const DESTINO_TAB: Record<DestinoReclassificacao, Section> = {
    imovel:           'imoveis',
    ativo_financeiro: 'ativosFinanceiros',
    participacao:     'participacoesSocietarias',
    credito:          'creditos',
    outro_bem:        'outrosBensEDireitos',
  }

  function reclassifyItem(source: ReclassifySource, index: number, destino: DestinoReclassificacao) {
    if (!localData) return

    // ── Extract item fields from source section (synchronous) ─────────────────
    let descricao = ''
    let valor = 0
    let src: 'dec' | 'pdf' | 'manual' = 'manual'
    let next = { ...localData }

    if (source === 'imovel') {
      const item = localData.imoveis[index]
      descricao = item.descricao; valor = item.valorDeclarado; src = item.source
      next = { ...next, imoveis: next.imoveis.filter((_, i) => i !== index) }
    } else if (source === 'ativo_financeiro') {
      const item = localData.ativosFinanceiros[index]
      descricao = item.descricao ?? item.tipo; valor = item.valorAproximado; src = item.source
      next = { ...next, ativosFinanceiros: next.ativosFinanceiros.filter((_, i) => i !== index) }
    } else if (source === 'participacao') {
      const item = localData.participacoesSocietarias[index]
      descricao = item.empresa; valor = item.valorPatrimonial ?? 0; src = item.source
      next = { ...next, participacoesSocietarias: next.participacoesSocietarias.filter((_, i) => i !== index) }
    } else if (source === 'credito') {
      const item = (localData.creditos ?? [])[index]
      descricao = item.devedor; valor = item.valorPrincipal; src = item.source
      next = { ...next, creditos: (next.creditos ?? []).filter((_, i) => i !== index) }
    }

    // ── Add to destination section ─────────────────────────────────────────────
    switch (destino) {
      case 'imovel':
        next = { ...next, imoveis: [...next.imoveis, {
          descricao, valorDeclarado: valor, source: src, needsReview: true,
        }]}
        break
      case 'ativo_financeiro':
        next = { ...next, ativosFinanceiros: [...next.ativosFinanceiros, {
          instituicao: '', tipo: 'Aplicação Financeira', valorAproximado: valor,
          descricao, source: src, needsReview: true,
        }]}
        break
      case 'participacao':
        next = { ...next, participacoesSocietarias: [...next.participacoesSocietarias, {
          empresa: descricao.slice(0, 80), cnpj: '', percentual: 0,
          valorPatrimonial: valor, source: src, needsReview: true,
        }]}
        break
      case 'credito':
        next = { ...next, creditos: [...(next.creditos ?? []), {
          devedor: descricao.slice(0, 80), tipoPessoa: 'PJ',
          valorPrincipal: valor, source: src, needsReview: true,
        }]}
        break
      case 'outro_bem':
        next = { ...next, outrosBensEDireitos: [...(next.outrosBensEDireitos ?? []), {
          descricao: descricao.slice(0, 200), grupo: '99', codigo: '99',
          valor, source: src, needsReview: true,
        }]}
        break
    }

    // Apply state, navigate, auto-save, and show toast
    setLocalData(next)
    setActiveSection(DESTINO_TAB[destino])
    save(next)

    const SECTION_LABEL: Record<DestinoReclassificacao, string> = {
      imovel: 'Imóveis', ativo_financeiro: 'Ativos Financeiros',
      participacao: 'Participações', credito: 'Crédito', outro_bem: 'Outros Bens',
    }
    setReclassifyToast(`Movido para ${SECTION_LABEL[destino]} ✓ — novo card ao final da lista`)
    setTimeout(() => setReclassifyToast(''), 5000)
  }

  async function handleReupload() {
    if (!reuploadFile || !playbook) return
    setReuploadError('')
    setReuploading(true)
    try {
      // 1. Upload with force=true — wipes any existing record for this client/year/type
      const formData = new FormData()
      formData.append('file', reuploadFile)
      formData.append('clientId', clientId)
      formData.append('irpfYear', String(reuploadYear))
      formData.append('force', 'true')

      const uploadRes = await fetch('/api/parse-irpf', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) { setReuploadError(uploadData.error || 'Erro no upload'); return }

      const { uploadId } = uploadData

      // 2. Poll until extraction completes
      const deadline = Date.now() + 300_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000))
        const poll = await fetch(`/api/parse-irpf/${uploadId}`)
        const pollData = await poll.json()
        if (pollData.parse_status === 'ok') break
        if (pollData.parse_status === 'error') {
          setReuploadError(pollData.parse_error || 'Falha na extração')
          return
        }
      }

      // 3. Regenerate playbook from fresh parsed_data (skip re-extraction — already done)
      const regenRes = await fetch(`/api/playbook/${playbook.id}/regenerate?reextract=false`, { method: 'POST' })
      const regenData = await regenRes.json()
      if (!regenRes.ok) { setReuploadError(regenData.error || 'Erro ao regenerar'); return }

      // 4. Reload
      const reload = await fetch(`/api/playbook?clientId=${clientId}`)
      if (reload.ok) {
        const row: PlaybookRow = await reload.json()
        setPlaybook(row)
        setLocalData(row.playbook_data)
      }

      setShowReupload(false)
      setReuploadFile(null)
      const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format
      const rec = regenData.reconciliation
      setRegenResult(rec
        ? `PDF reextraído — declarado ${fmt(rec.totalDeclarado)} / extraído ${fmt(rec.totalExtracted)}`
        : `PDF reextraído — IRPF ${regenData.irpfYear}`)
      setTimeout(() => setRegenResult(''), 10000)
    } catch {
      setReuploadError('Erro inesperado')
    } finally {
      setReuploading(false)
    }
  }

  function flagCount(section: string): number {
    return (localData?.reviewFlags ?? []).filter(f => f.section === section).length
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando playbook…</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-500">Nenhum playbook encontrado para este cliente.</p>
        <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-gray-600 underline">
          ← Voltar ao início
        </button>
      </main>
    )
  }

  if (!localData || !playbook) return null

  const totalFlags = localData.reviewFlags.length
  const globalFlags = localData.reviewFlags.filter(f => f.section === 'geral')

  const sections: { id: Section; label: string }[] = [
    { id: 'briefing',                 label: 'Briefing' },
    { id: 'dadosPessoais',            label: 'Dados Pessoais' },
    { id: 'imoveis',                  label: 'Imóveis' },
    { id: 'ativosFinanceiros',        label: 'Ativos Financeiros' },
    { id: 'creditos',                 label: 'Crédito' },
    { id: 'participacoesSocietarias', label: 'Participações' },
    { id: 'outrosBensEDireitos',      label: 'Outros B&D' },
    { id: 'documentos',               label: 'Documentos' },
    { id: 'revisao',                  label: 'Revisão' },
  ]

  const totalImoveis = localData.imoveis.reduce((s, im) => s + im.valorDeclarado, 0)
  const totalAtivos = localData.ativosFinanceiros.reduce((s, a) => s + a.valorAproximado, 0)
  const totalParticipacoes = localData.participacoesSocietarias.reduce((s, p) => s + (p.valorPatrimonial ?? 0), 0)
  const totalCreditos = (localData.creditos ?? []).filter(c => c.statusCredito !== 'quitado').reduce((s, c) => s + c.valorPrincipal, 0)
  const totalOutrosBensEDireitos = (localData.outrosBensEDireitos ?? []).reduce((s, i) => s + i.valor, 0)
  const totalOutros = (localData.outrosBensValor ?? 0) + totalOutrosBensEDireitos
  const totalPatrimonio = totalImoveis + totalAtivos + totalParticipacoes + totalCreditos + totalOutros

  return (
    <main className="min-h-screen bg-amber-50">

      {/* Reclassify toast */}
      {reclassifyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-olive-900 text-white text-xs px-5 py-3 rounded-2xl shadow-xl pointer-events-none">
          {reclassifyToast}
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (
        <ExportModal
          playbookId={playbook.id}
          playbookData={localData ?? undefined}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Re-upload IRPF modal */}
      {showReupload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDragEnter={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => { e.preventDefault(); e.stopPropagation() }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Re-upload IRPF</h2>
              <button onClick={() => { setShowReupload(false); setReuploadFile(null); setReuploadError('') }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Substitui o arquivo anterior e re-extrai todos os dados do zero com o prompt atualizado.
              O processo leva ~2 minutos para PDFs.
            </p>

            {/* Year selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ano-Calendário</label>
              <select
                value={reuploadYear}
                onChange={e => setReuploadYear(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-olive-400 bg-white"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 1 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* File drop area */}
            <div
              onClick={() => reuploadInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                const f = e.dataTransfer.files?.[0]
                if (!f) return
                const n = f.name.toLowerCase()
                if (!n.endsWith('.dec') && !n.endsWith('.pdf')) {
                  setReuploadError('Arquivo inválido. Envie um .DEC ou .PDF.')
                  return
                }
                setReuploadError('')
                setReuploadFile(f)
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                reuploadFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                ref={reuploadInputRef}
                type="file"
                accept=".dec,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const n = f.name.toLowerCase()
                  if (!n.endsWith('.dec') && !n.endsWith('.pdf')) {
                    setReuploadError('Arquivo inválido. Envie um .DEC ou .PDF.')
                    return
                  }
                  setReuploadError('')
                  setReuploadFile(f)
                }}
              />
              {reuploadFile ? (
                <div>
                  <p className="text-sm font-medium text-green-700">{reuploadFile.name}</p>
                  <p className="text-xs text-green-600 mt-1">{(reuploadFile.size / 1024).toFixed(1)} KB — clique para trocar</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">Clique ou arraste o arquivo aqui</p>
                  <p className="text-xs text-gray-400 mt-1">.DEC · .PDF</p>
                </div>
              )}
            </div>

            {reuploadError && <p className="text-xs text-red-600">{reuploadError}</p>}

            {reuploading && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-amber-800">Extraindo… pode levar até 2 minutos</p>
                <p className="text-xs text-amber-600 mt-1">Não feche esta janela.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowReupload(false); setReuploadFile(null); setReuploadError('') }}
                disabled={reuploading}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReupload}
                disabled={!reuploadFile || reuploading}
                className="flex-1 bg-olive-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-olive-800 disabled:opacity-50 transition-colors"
              >
                {reuploading ? 'Processando…' : 'Enviar e reprocessar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-gray-600">
            ← Início
          </button>
          <span className="text-gray-200">|</span>
          <h1 className="text-sm font-semibold text-gray-900">Manual Patrimonial</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(playbook.status)}`}>
            {statusLabel(playbook.status)}
          </span>
          {totalFlags > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-olive-100 text-olive-700 font-medium">
              {totalFlags} {totalFlags === 1 ? 'item para revisar' : 'itens para revisar'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          {saved && <span className="text-xs text-green-600">Salvo ✓</span>}
          {regenResult && (
            <span className={`text-xs ${regenResult.startsWith('Erro') ? 'text-red-600' : 'text-olive-700'}`}>
              {regenResult}
            </span>
          )}

          {/* Re-upload IRPF */}
          <button
            onClick={() => { setShowReupload(true); setReuploadError('') }}
            disabled={reuploading || regenerating}
            title="Envie um novo PDF/DEC para este cliente e reprocesse do zero."
            className="px-3 py-2 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            ↑ Re-upload IRPF
          </button>

          {/* Reprocessar IRPF */}
          <button
            onClick={() => reprocessarIRPF()}
            disabled={regenerating || reuploading}
            title="PDF: re-extrai via IA com prompt atualizado (~2 min). DEC: reclassifica ativos (rápido)."
            className="px-3 py-2 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Extraindo PDF… aguarde' : '↺ Reprocessar IRPF'}
          </button>

          {/* Gerar PDF → opens modal */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-sm font-medium border border-olive-900 text-olive-900 rounded-lg hover:bg-olive-900 hover:text-white transition-colors"
          >
            Gerar PDF
          </button>

          <button
            onClick={() => save()}
            disabled={saving}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>

          {playbook.status === 'draft' && (
            <button onClick={() => advanceStatus('in_review')} disabled={saving}
              className="px-4 py-2 text-sm bg-olive-600 text-white rounded-lg hover:bg-olive-700 disabled:opacity-50 transition-colors">
              Enviar para revisão →
            </button>
          )}
          {playbook.status === 'in_review' && (
            <button onClick={() => advanceStatus('approved')} disabled={saving}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors">
              Aprovar ✓
            </button>
          )}
          {playbook.status === 'approved' && (
            <button onClick={() => advanceStatus('delivered')} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors">
              Marcar entregue
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Global flags */}
        {globalFlags.map((f, i) => (
          <div key={i} className="mb-4 text-xs px-3 py-2 rounded-lg border border-olive-200 bg-amber-50 text-olive-700">
            {f.message}
          </div>
        ))}

        {/* Summary strip — 6 uniform boxes */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Patrimônio total', value: formatBRL(totalPatrimonio), sub: 'valor declarado' },
            { label: 'Imóveis',            value: String(localData.imoveis.length),                                                                              sub: totalImoveis > 0 ? formatBRL(totalImoveis) : '—' },
            { label: 'Ativos financeiros', value: String(localData.ativosFinanceiros.length),                                                                    sub: totalAtivos > 0 ? formatBRL(totalAtivos) : '—' },
            { label: 'Crédito ativo',      value: String((localData.creditos ?? []).filter(c => c.statusCredito !== 'quitado').length),                          sub: totalCreditos > 0 ? formatBRL(totalCreditos) : '—' },
            { label: 'Participações',      value: String(localData.participacoesSocietarias.length),                                                             sub: totalParticipacoes > 0 ? formatBRL(totalParticipacoes) : '—' },
            { label: 'Outros B&D',         value: String((localData.outrosBensEDireitos ?? []).length),                                                          sub: totalOutrosBensEDireitos > 0 ? formatBRL(totalOutrosBensEDireitos) : ((localData.outrosBens ?? []).length > 0 ? `${localData.outrosBens!.length} a classificar` : '—') },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
              <div className="bg-olive-900 px-4 py-3 h-[72px] flex flex-col justify-between overflow-hidden">
                <p className="text-xs text-olive-200 truncate">{label}</p>
                <p className="text-xl font-bold text-white leading-tight truncate">{value}</p>
              </div>
              <div className="bg-amber-50 px-4 py-2 h-[36px] flex items-center overflow-hidden">
                <p className="text-xs text-gray-400 truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
            {sections.map(s => (
              <Tab
                key={s.id}
                id={s.id}
                label={s.label}
                active={activeSection === s.id}
                flagCount={flagCount(s.id)}
                onClick={() => setActiveSection(s.id)}
              />
            ))}
          </div>

          <div className="p-6">
            {activeSection === 'briefing' && (
              <BriefingSection
                briefing={localData.briefing ?? {}}
                onChange={b => setLocalData(prev => prev ? { ...prev, briefing: b } : prev)}
              />
            )}
            {activeSection === 'dadosPessoais' && (
              <DadosPessoaisSection
                data={localData.dadosPessoais}
                onChange={d => setLocalData(prev => prev ? { ...prev, dadosPessoais: d } : prev)}
                patrimonio={{
                  imoveis: totalImoveis,
                  ativos: totalAtivos,
                  participacoes: totalParticipacoes,
                  creditos: totalCreditos,
                  outros: totalOutros,
                  totalIRPFDeclarado: localData.totalIRPFDeclarado,
                }}
              />
            )}
            {activeSection === 'imoveis' && (
              <ImoveisSection
                imoveis={localData.imoveis}
                flags={localData.reviewFlags}
                clientId={clientId}
                onChange={items => setLocalData(prev => prev ? { ...prev, imoveis: items } : prev)}
                onReclassify={(i, d) => reclassifyItem('imovel', i, d)}
              />
            )}
            {activeSection === 'ativosFinanceiros' && (
              <AtivosSection
                ativos={localData.ativosFinanceiros}
                flags={localData.reviewFlags}
                clientId={clientId}
                extratosAnexos={localData.extratosAnexos ?? []}
                instituicoes={localData.instituicoesFinanceiras ?? []}
                onChange={items => setLocalData(prev => prev ? { ...prev, ativosFinanceiros: items } : prev)}
                onExtratosChange={anexos => setLocalData(prev => prev ? { ...prev, extratosAnexos: anexos } : prev)}
                onInstituicoesChange={items => setLocalData(prev => prev ? { ...prev, instituicoesFinanceiras: items } : prev)}
                onReclassify={(i, d) => reclassifyItem('ativo_financeiro', i, d)}
              />
            )}
            {activeSection === 'creditos' && (
              <CreditoSection
                creditos={localData.creditos ?? []}
                clientId={clientId}
                onChange={items => setLocalData(prev => prev ? { ...prev, creditos: items } : prev)}
                onReclassify={(i, d) => reclassifyItem('credito', i, d)}
              />
            )}
            {activeSection === 'participacoesSocietarias' && (
              <ParticipacaoSection
                participacoes={localData.participacoesSocietarias}
                flags={localData.reviewFlags}
                clientId={clientId}
                onChange={items => setLocalData(prev => prev ? { ...prev, participacoesSocietarias: items } : prev)}
                onReclassify={(i, d) => reclassifyItem('participacao', i, d)}
              />
            )}
            {activeSection === 'outrosBensEDireitos' && (
              <OutrosBensEDireitosSection
                outrosBens={localData.outrosBens ?? []}
                outrosBensEDireitos={localData.outrosBensEDireitos ?? []}
                onPendingChange={items => setLocalData(prev => prev ? { ...prev, outrosBens: items } : prev)}
                onChange={items => setLocalData(prev => prev ? { ...prev, outrosBensEDireitos: items } : prev)}
                onReprocessar={async () => { await save(); await reprocessarIRPF(true) }}
                regenerating={regenerating}
              />
            )}
            {activeSection === 'documentos' && (
              <DocumentosSection
                clientId={clientId}
                documentos={localData.documentosVitais ?? []}
                onChange={docs => setLocalData(prev => prev ? { ...prev, documentosVitais: docs } : prev)}
                midiaFamiliar={localData.dadosPessoais.midiaFamiliar ?? []}
                onMidiaChange={items => setLocalData(prev => prev ? {
                  ...prev,
                  dadosPessoais: { ...prev.dadosPessoais, midiaFamiliar: items }
                } : prev)}
              />
            )}
            {activeSection === 'revisao' && (
              <ReviewSection
                data={localData}
                onUpdateReview={items => setLocalData(prev => prev ? { ...prev, advisorReview: items } : prev)}
              />
            )}
          </div>
        </div>

        {/* Advisor notes */}
        <div className="mt-6 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="bg-olive-900 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Notas do Assessor</h3>
            <p className="text-xs text-olive-200 mt-0.5">Não incluídas no documento final entregue ao cliente</p>
          </div>
          <div className="bg-amber-50 px-5 py-4">
            <textarea
              value={localData.observacoesAdvisor ?? ''}
              onChange={e => setLocalData(prev => prev ? { ...prev, observacoesAdvisor: e.target.value } : prev)}
              placeholder="Observações internas, pendências, notas de reunião…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-olive-200 resize-none bg-white"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
