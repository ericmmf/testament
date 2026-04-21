'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { IRPFData } from '@/lib/types/irpf'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function currentIRPFYear(): number {
  return new Date().getFullYear() - 1
}

function irpfYearOptions(): number[] {
  const end = currentIRPFYear()
  const years = []
  for (let y = end; y >= 2015; y--) years.push(y)
  return years
}

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'cliente' | 'upload' | 'resultado'

interface ParseResult {
  uploadId: string
  fileType: 'dec' | 'pdf'
  irpfYear: number
  parsedData: IRPFData
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NovoClientePage() {
  const router = useRouter()

  // Step control
  const [step, setStep] = useState<Step>('cliente')

  // Step 1 — client form
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')

  // Step 2 — upload
  const [irpfYear, setIrpfYear] = useState(currentIRPFYear())
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3 — result
  const [result, setResult] = useState<ParseResult | null>(null)

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Step 1: create client ──────────────────────────────────────────────────

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: nome, cpf, email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar cliente')
        return
      }

      setClientId(data.id)
      setClientName(data.full_name)
      setStep('upload')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: generate playbook and navigate ────────────────────────────────

  async function handleOpenPlaybook() {
    if (!result || !clientId) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, uploadId: result.uploadId }),
      })

      const data = await res.json()

      if (!res.ok && res.status !== 201) {
        const detail = data.details || data.hint || ''
        setError(`Erro ao gerar playbook${detail ? `: ${detail}` : ''}`)
        return
      }

      router.push(`/clientes/${clientId}/playbook`)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: upload and parse ───────────────────────────────────────────────

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSetFile(dropped)
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) validateAndSetFile(selected)
  }

  function validateAndSetFile(f: File) {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.dec') && !name.endsWith('.pdf')) {
      setError('Arquivo inválido. Envie um .DEC ou .PDF.')
      return
    }
    setError('')
    setFile(f)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Selecione um arquivo para continuar.')
      return
    }
    setError('')
    setLoading(true)

    try {
      // Step 1 — upload file, get uploadId immediately (fast)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('irpfYear', String(irpfYear))

      const uploadRes = await fetch('/api/parse-irpf', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setError(uploadData.error || 'Erro ao enviar arquivo')
        return
      }

      const { uploadId, fileType, irpfYear: returnedYear } = uploadData

      // Step 2 — poll until parse_status is 'ok' or 'error'
      const parsedData = await pollForResult(uploadId)

      setResult({ uploadId, fileType, irpfYear: returnedYear, parsedData })
      setStep('resultado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no processamento do arquivo')
    } finally {
      setLoading(false)
    }
  }

  async function pollForResult(uploadId: string, maxWaitMs = 300000): Promise<IRPFData> {
    const interval = 3000
    const deadline = Date.now() + maxWaitMs
    let consecutiveNetworkErrors = 0
    const maxNetworkErrors = 5  // tolerate hot-reload / transient drops

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, interval))

      let res: Response
      let data: Record<string, unknown>
      try {
        res = await fetch(`/api/parse-irpf/${uploadId}`)
        data = await res.json()
      } catch {
        // Network error (ECONNRESET, server restart, etc.) — retry up to limit
        consecutiveNetworkErrors++
        if (consecutiveNetworkErrors >= maxNetworkErrors) {
          throw new Error('Falha de conexão ao verificar o processamento. Verifique sua rede e tente novamente.')
        }
        continue
      }

      consecutiveNetworkErrors = 0  // reset on successful response

      if (!res.ok) throw new Error(`Erro ao verificar status (${res.status})`)

      if (data.parse_status === 'ok') return data.parsed_data as IRPFData
      if (data.parse_status === 'error') {
        throw new Error(
          typeof data.parse_error === 'string' && data.parse_error
            ? `Falha no processamento: ${data.parse_error}`
            : 'Falha no processamento do arquivo'
        )
      }
      // 'pending' or 'processing' — keep polling
    }

    throw new Error('Tempo limite excedido — o arquivo ainda está sendo processado')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center py-12 px-4">

      {/* Header */}
      <div className="w-full max-w-lg mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Novo Cliente</h1>
        <StepIndicator current={step} />
      </div>

      {/* Step 1 — Cliente */}
      {step === 'cliente' && (
        <form onSubmit={handleCreateClient} className="w-full max-w-lg bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              placeholder="Nome do cliente"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-400 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(formatCPF(e.target.value))}
              required
              placeholder="000.000.000-00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-400 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-400 bg-white"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-olive-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-olive-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Criando...' : 'Continuar →'}
          </button>
        </form>
      )}

      {/* Step 2 — Upload */}
      {step === 'upload' && (
        <form onSubmit={handleUpload} className="w-full max-w-lg bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <p className="text-sm text-gray-500">
            Cliente: <span className="font-medium text-gray-900">{clientName}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano-Calendário</label>
            <select
              value={irpfYear}
              onChange={e => setIrpfYear(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-400 bg-white"
            >
              {irpfYearOptions().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${dragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-green-50 border-green-400' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".dec,.pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600 mt-1">{(file.size / 1024).toFixed(1)} KB — clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-gray-400 mt-1">Formatos aceitos: .DEC · .PDF</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full bg-olive-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-olive-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processando… pode levar alguns minutos' : 'Processar arquivo'}
          </button>
        </form>
      )}

      {/* Step 3 — Resultado */}
      {step === 'resultado' && result && (
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <p className="text-sm font-medium text-gray-900">Arquivo processado com sucesso</p>
          </div>

          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 text-sm">
            <Row label="Cliente" value={clientName} />
            <Row label="Ano-Calendário" value={String(result.irpfYear)} />
            <Row label="Fonte" value={result.fileType === 'dec' ? '.DEC (determinístico)' : 'PDF (extração via IA)'} />
            <Row label="Declarante" value={result.parsedData.dadosDeclarante?.nome || '—'} />
            <Row label="CPF" value={result.parsedData.dadosDeclarante?.cpf || '—'} />
            <Row label="Bens declarados" value={String(result.parsedData.bensEDireitos?.length ?? 0)} />
            <Row label="Dívidas declaradas" value={String(result.parsedData.dividas?.length ?? 0)} />
            <Row label="Dependentes" value={String(result.parsedData.dependentes?.length ?? 0)} />
          </div>

          {result.parsedData.confidenceNotes?.length > 0 && (
            <div className="bg-amber-50 border border-olive-200 rounded-lg p-4">
              <p className="text-xs font-medium text-olive-800 mb-2">Notas de revisão</p>
              <ul className="space-y-1">
                {result.parsedData.confidenceNotes.map((note, i) => (
                  <li key={i} className="text-xs text-olive-700">· {note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              Voltar ao início
            </button>
            <button
              onClick={handleOpenPlaybook}
              disabled={loading}
              className="flex-1 bg-olive-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-olive-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Gerando playbook…' : 'Ver playbook →'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'cliente', label: 'Cliente' },
    { id: 'upload', label: 'Declaração' },
    { id: 'resultado', label: 'Resultado' },
  ]
  const idx = steps.findIndex(s => s.id === current)

  return (
    <div className="flex items-center gap-2 mt-3">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
            ${i < idx ? 'bg-olive-900 text-white' : i === idx ? 'bg-olive-900 text-white' : 'bg-gray-200 text-gray-400'}
          `}>
            {i < idx ? '✓' : i + 1}
          </div>
          <span className={`text-xs ${i === idx ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-200 mx-1">—</span>}
        </div>
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}
