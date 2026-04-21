'use client'

import { useState, useRef } from 'react'

// Generic doc record — compatible with AnexoCredito and RecordAnexo
export interface DocRecord {
  nome?: string
  fileName?: string
  storagePath?: string
  uploadedAt?: string
  status: 'pendente' | 'enviado'
}

interface Props {
  docs: DocRecord[]
  clientId: string
  categoria: string                       // e.g. 'contrato_credito_0'
  docType: 'credito' | 'participacao'
  existingData?: Record<string, unknown>  // current card fields — passed as context to Claude
  onUpdate: (items: DocRecord[]) => void
  onInterpret: (fields: Record<string, unknown>) => void
}

async function getSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/documentos/signed-url?path=${encodeURIComponent(storagePath)}`)
    if (!res.ok) return null
    const { url } = await res.json()
    return url
  } catch {
    return null
  }
}

export function ContratosPanel({ docs, clientId, categoria, docType, existingData, onUpdate, onInterpret }: Props) {
  const [uploading, setUploading]             = useState(false)
  const [uploadError, setUploadError]         = useState('')
  const [interpretingIdx, setInterpretingIdx] = useState<number | null>(null)
  const [interpretError, setInterpretError]   = useState('')
  const [dragOver, setDragOver]               = useState(false)
  const [downloadingIdx, setDownloadingIdx]   = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file',      file)
      formData.append('clientId',  clientId)
      formData.append('categoria', categoria)

      const res = await fetch('/api/contratos', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json()
        setUploadError(body.error || 'Erro no upload')
        return
      }
      const { fileName, storagePath } = await res.json()
      const newDoc: DocRecord = {
        nome:       file.name,
        fileName,
        storagePath,
        uploadedAt: new Date().toISOString(),
        status:     'enviado',
      }
      onUpdate([...docs, newDoc])
    } catch {
      setUploadError('Falha na conexão')
    } finally {
      setUploading(false)
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  async function downloadDoc(doc: DocRecord, idx: number) {
    if (!doc.storagePath) return
    setDownloadingIdx(idx)
    try {
      const url = await getSignedUrl(doc.storagePath)
      if (!url) { setInterpretError('Erro ao gerar link de download'); return }
      window.open(url, '_blank', 'noopener')
    } finally {
      setDownloadingIdx(null)
    }
  }

  // ── Interpret ─────────────────────────────────────────────────────────────────

  async function interpretDoc(doc: DocRecord, idx: number) {
    if (!doc.storagePath) return
    setInterpretingIdx(idx)
    setInterpretError('')
    try {
      const res = await fetch('/api/interpret-doc', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          storagePath: doc.storagePath,
          docType,
          ...(existingData ? { existingData } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setInterpretError(body.error || 'Erro na interpretação')
        return
      }
      const { fields } = await res.json()
      onInterpret(fields)
    } catch {
      setInterpretError('Falha na conexão')
    } finally {
      setInterpretingIdx(null)
    }
  }

  // ── Remove ───────────────────────────────────────────────────────────────────

  function removeDoc(idx: number) {
    onUpdate(docs.filter((_, i) => i !== idx))
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Contratos e Documentos
        </h4>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-olive-700 hover:text-olive-900 underline disabled:opacity-50"
        >
          {uploading ? 'Enviando…' : '+ Adicionar'}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.odt,.csv,.md"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
          e.target.value = ''
        }}
      />

      {/* Drop zone — only shown when no docs or always */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl py-4 px-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-olive-400 bg-olive-50'
            : 'border-gray-200 hover:border-olive-300 hover:bg-amber-50'
        }`}
      >
        <p className="text-xs text-gray-400">
          {uploading
            ? 'Enviando…'
            : 'Arraste um arquivo aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-gray-300 mt-0.5">PDF, DOCX, TXT, PPT, XLS e outros</p>
      </div>

      {/* Error messages */}
      {(uploadError || interpretError) && (
        <p className="text-xs text-red-500">{uploadError || interpretError}</p>
      )}

      {/* File list */}
      {docs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {docs.map((doc, idx) => {
            const name = doc.nome || doc.fileName || 'Documento'
            const isInterpreting = interpretingIdx === idx
            const isDownloading  = downloadingIdx === idx

            return (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  doc.status === 'enviado' ? 'bg-emerald-400' : 'bg-gray-200'
                }`} />

                {/* Filename */}
                <span className="flex-1 text-xs text-gray-700 truncate font-medium">
                  {name}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Download */}
                  {doc.storagePath && (
                    <button
                      onClick={() => downloadDoc(doc, idx)}
                      disabled={isDownloading}
                      title="Baixar arquivo"
                      className="text-xs text-olive-700 hover:text-olive-900 underline disabled:opacity-50"
                    >
                      {isDownloading ? '…' : 'Baixar'}
                    </button>
                  )}

                  {/* Interpretar */}
                  {doc.storagePath && (
                    <button
                      onClick={() => interpretDoc(doc, idx)}
                      disabled={isInterpreting || interpretingIdx !== null}
                      title="Claude lê o documento e preenche os campos automaticamente"
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                        isInterpreting
                          ? 'border-olive-300 text-olive-600 bg-olive-50 cursor-wait'
                          : 'border-olive-300 text-olive-800 hover:bg-olive-50'
                      }`}
                    >
                      {isInterpreting ? 'Interpretando…' : '✦ Interpretar'}
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removeDoc(idx)}
                    title="Remover"
                    className="text-red-300 hover:text-red-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Interpreting hint */}
      {interpretingIdx !== null && (
        <p className="text-xs text-olive-600 italic text-center animate-pulse">
          Claude está lendo o documento e extraindo os dados…
        </p>
      )}
    </div>
  )
}
