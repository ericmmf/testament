import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const BUCKET = 'documentos-vitais'

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const categoria = formData.get('categoria') as string | null

    if (!file || !clientId || !categoria) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede 10MB' }, { status: 413 })
    }

    const ext = ALLOWED_MIME[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 415 })
    }

    const supabase = createAdminClient()

    // Ensure bucket exists (idempotent)
    const { data: buckets } = await supabase.storage.listBuckets()
    const exists = buckets?.some(b => b.name === BUCKET)
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: false })
      if (createErr && createErr.message !== 'Bucket already exists') {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
    }

    // Path: <clientId>/<categoria>/<timestamp>.<ext>
    const timestamp = Date.now()
    const storagePath = `${clientId}/${categoria}/${timestamp}.${ext}`
    const fileName = `${categoria}_${timestamp}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    return NextResponse.json({ fileName, storagePath })
  } catch (err) {
    console.error('[documentos] upload error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
