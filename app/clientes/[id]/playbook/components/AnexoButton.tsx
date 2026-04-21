'use client'

import { useState, useRef } from 'react'
import { RecordAnexo } from '@/lib/types/playbook'

interface Props {
  anexos: RecordAnexo[]
  clientId: string
  categoria: string        // e.g. 'imovel_0', 'participacao_2'
  onUpdate: (updated: RecordAnexo[]) => void
}

function detectarTipo(nome: string): string {
  const n = nome.toLowerCase()
  if (n.includes('matr')) return 'Matrícula'
  if (n.includes('contrat')) return 'Contrato'
  if (n.includes('escritura')) return 'Escritura'
  if (n.includes('iptu')) return 'IPTU'
  return nome
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

export function AnexoButton({ anexos, clientId, categoria, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const sentCount = anexos.filter(a => a.status === 'enviado').length

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('categoria', categoria)

      const res = await fetch('/api/documentos', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Erro no upload')
        return
      }
      const { fileName, storagePath } = await res.json()
      const newAnexo: RecordAnexo = {
        nome: detectarTipo(file.name),
        fileName,
        storagePath,
        uploadedAt: new Date().toISOString(),
        status: 'enviado',
      }
      onUpdate([...anexos, newAnexo])
    } catch {
      setError('Falha na conexão')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(anexo: RecordAnexo, idx: number) {
    if (!anexo.storagePath) return
    setDownloadingIdx(idx)
    try {
      const url = await getSignedUrl(anexo.storagePath)
      if (!url) { setError('Erro ao gerar link'); return }
      window.open(url, '_blank', 'noopener')
    } finally {
      setDownloadingIdx(null)
    }
  }

  function removeAnexo(idx: number) {
    onUpdate(anexos.filter((_, i) => i !== idx))
  }

  return (
    <div className="relative">
      {/* Paperclip trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Anexos"
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
          sentCount > 0
            ? 'border-olive-300 text-olive-800 bg-amber-50 hover:bg-olive-100'
            : 'border-gray-200 text-gray-400 hover:border-olive-300 hover:text-olive-700 bg-white'
        }`}
      >
        {/* Paperclip SVG */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        {sentCount > 0 ? sentCount : ''}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
          {/* Header */}
          <div className="bg-olive-900 px-4 py-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white">Anexos</h4>
            <button onClick={() => setOpen(false)} className="text-olive-200 hover:text-white text-sm">✕</button>
          </div>

          {/* List */}
          <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
            {anexos.length === 0 && (
              <p className="text-xs text-gray-300 text-center py-4">Nenhum anexo.</p>
            )}
            {anexos.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'enviado' ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                <span className="flex-1 text-xs text-gray-700 truncate">{a.nome || a.fileName || 'Documento'}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {a.storagePath && (
                    <button
                      onClick={() => handleDownload(a, i)}
                      disabled={downloadingIdx === i}
                      title="Baixar"
                      className="text-olive-700 hover:text-olive-900 disabled:opacity-40"
                    >
                      {downloadingIdx === i ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      )}
                    </button>
                  )}
                  <button onClick={() => removeAnexo(i)} title="Remover" className="text-red-300 hover:text-red-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Upload footer */}
          <div className="px-4 py-3 bg-amber-50 border-t border-olive-100">
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full text-xs text-olive-800 border border-olive-300 rounded-lg py-1.5 hover:bg-olive-100 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Enviando…' : '+ Adicionar arquivo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
