'use client'

import { useState, useRef } from 'react'
import { DocumentoVital, DocumentoStatus, MidiaFamiliar } from '@/lib/types/playbook'

interface Props {
  clientId: string
  documentos: DocumentoVital[]
  onChange: (docs: DocumentoVital[]) => void
  midiaFamiliar?: MidiaFamiliar[]
  onMidiaChange?: (items: MidiaFamiliar[]) => void
}

// Predefined document slots in order
const PREDEFINED: { categoria: string; nome: string }[] = [
  { categoria: 'certidao_nascimento',  nome: 'Certidão de Nascimento' },
  { categoria: 'certidao_casamento',   nome: 'Certidão de Casamento' },
  { categoria: 'identidade',           nome: 'RG / CNH' },
  { categoria: 'cpf',                  nome: 'CPF' },
  { categoria: 'testamento',           nome: 'Testamento' },
  { categoria: 'escritura',            nome: 'Escrituras de Imóveis' },
  { categoria: 'contrato_social',      nome: 'Contrato Social / Estatuto' },
]

function statusBadge(status: DocumentoStatus) {
  if (status === 'enviado') {
    return (
      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
        Enviado ✓
      </span>
    )
  }
  return (
    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">
      Pendente
    </span>
  )
}

function DocSlot({
  doc,
  clientId,
  onUpdate,
}: {
  doc: DocumentoVital
  clientId: string
  onUpdate: (updated: DocumentoVital) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('categoria', doc.categoria)

      const res = await fetch('/api/documentos', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Erro no upload')
        return
      }
      const { fileName, storagePath } = await res.json()
      onUpdate({
        ...doc,
        status: 'enviado',
        fileName,
        storagePath,
        uploadedAt: new Date().toISOString(),
      })
    } catch {
      setError('Falha na conexão')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
      {/* Status indicator dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        doc.status === 'enviado' ? 'bg-emerald-400' : 'bg-gray-200'
      }`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{doc.nome}</p>
        {doc.status === 'enviado' && doc.fileName ? (
          <p className="text-xs text-gray-400 truncate mt-0.5">{doc.fileName}</p>
        ) : (
          <p className="text-xs text-gray-300 mt-0.5">Nenhum arquivo enviado</p>
        )}
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {statusBadge(doc.status)}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            // Reset so same file can be re-uploaded
            e.target.value = ''
          }}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 hover:border-gray-400 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Enviando…' : doc.status === 'enviado' ? 'Substituir' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

// ── Mídia Familiar block ──────────────────────────────────────────────────────

function detectPlataforma(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('photos.google') || u.includes('photos.app.goo')) return 'Google Fotos'
  if (u.includes('icloud.com')) return 'iCloud'
  if (u.includes('drive.google')) return 'Google Drive'
  if (u.includes('dropbox')) return 'Dropbox'
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube'
  if (u.includes('vimeo')) return 'Vimeo'
  if (u.includes('onedrive') || u.includes('1drv')) return 'OneDrive'
  return ''
}

function MidiaFamiliarBlock({
  items,
  onChange,
}: {
  items: MidiaFamiliar[]
  onChange: (items: MidiaFamiliar[]) => void
}) {
  function add() {
    onChange([...items, { label: '', url: '', plataforma: '' }])
  }
  function update(i: number, field: keyof MidiaFamiliar, value: string) {
    const updated = [...items]
    const item = { ...updated[i], [field]: value }
    if (field === 'url') item.plataforma = detectPlataforma(value)
    updated[i] = item
    onChange(updated)
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i))
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="bg-olive-900 px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-sm flex-shrink-0">📷</div>
        <div>
          <h3 className="text-sm font-semibold text-white">Mídia Familiar</h3>
          <p className="text-xs text-olive-200 mt-0.5">Fotos, vídeos e álbuns em nuvem</p>
        </div>
      </div>
      <div className="bg-amber-50 px-5 py-4 space-y-3">
        <p className="text-xs text-gray-400">
          Links para acervos digitais: Google Fotos, iCloud, Drive, YouTube, etc.
        </p>
        {items.map((m, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {m.plataforma && (
                  <span className="text-xs bg-olive-100 text-olive-700 px-2 py-0.5 rounded-full font-medium">{m.plataforma}</span>
                )}
                <span className="text-sm font-medium text-gray-700">{m.label || `Mídia ${i + 1}`}</span>
              </div>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-600">remover</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
                <input
                  type="text"
                  value={m.label}
                  onChange={e => update(i, 'label', e.target.value)}
                  placeholder="Ex.: Fotos de família, Álbum casamento"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Link / URL</label>
                <input
                  type="text"
                  value={m.url}
                  onChange={e => update(i, 'url', e.target.value)}
                  placeholder="https://photos.google.com/…"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={add}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + Adicionar link de mídia
        </button>
      </div>
    </div>
  )
}

export function DocumentosSection({ clientId, documentos, onChange, midiaFamiliar, onMidiaChange }: Props) {
  // Merge predefined slots with any existing docs; add custom extras
  const predefinedCats = new Set(PREDEFINED.map(p => p.categoria))

  // Build canonical list: predefined slots first, then any custom ones
  const slotMap = new Map<string, DocumentoVital>()
  for (const doc of documentos) {
    slotMap.set(doc.categoria + ':' + doc.nome, doc)
  }

  // Resolve each predefined slot (existing or blank)
  const slots: DocumentoVital[] = PREDEFINED.map(p => {
    // Match by categoria (first match)
    const existing = documentos.find(d => d.categoria === p.categoria)
    return existing ?? { categoria: p.categoria, nome: p.nome, status: 'pendente' }
  })

  // Custom extras — docs not in predefined list
  const extras = documentos.filter(d => !predefinedCats.has(d.categoria))

  const allSlots = [...slots, ...extras]

  function updateSlot(updated: DocumentoVital) {
    // Replace or insert by categoria+nome
    const next = allSlots.map(s =>
      s.categoria === updated.categoria && s.nome === updated.nome ? updated : s
    )
    // If not found in allSlots, append
    if (!next.find(s => s.categoria === updated.categoria && s.nome === updated.nome)) {
      next.push(updated)
    }
    onChange(next)
  }

  function addCustomSlot() {
    const newDoc: DocumentoVital = {
      categoria: 'outro_' + Date.now(),
      nome: 'Documento adicional',
      status: 'pendente',
    }
    onChange([...allSlots, newDoc])
  }

  const sentCount = allSlots.filter(d => d.status === 'enviado').length
  const totalCount = allSlots.length

  return (
    <div className="space-y-5">

      {/* Section header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Documentos Vitais</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {sentCount} de {totalCount} documentos enviados
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${totalCount > 0 ? Math.round(sentCount / totalCount * 100) : 0}%` }}
        />
      </div>

      {/* Document list */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">

        {/* Card header */}
        <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-sm">📁</div>
            <div>
              <h3 className="text-sm font-semibold text-white">Documentos Sucessórios</h3>
              <p className="text-xs text-olive-200 mt-0.5">PDF, JPG ou DOCX · máx. 10MB por arquivo</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-white bg-white/10 px-3 py-1 rounded-full">
            {sentCount}/{totalCount}
          </span>
        </div>

        {/* Slots list */}
        <div className="bg-amber-50 px-5 py-2">
          {allSlots.map((doc, i) => (
            <DocSlot
              key={`${doc.categoria}-${i}`}
              doc={doc}
              clientId={clientId}
              onUpdate={updateSlot}
            />
          ))}
        </div>
      </div>

      {/* Add custom document */}
      <button
        onClick={addCustomSlot}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Adicionar documento personalizado
      </button>

      {/* Mídia Familiar */}
      {onMidiaChange && (
        <MidiaFamiliarBlock
          items={midiaFamiliar ?? []}
          onChange={onMidiaChange}
        />
      )}

    </div>
  )
}
