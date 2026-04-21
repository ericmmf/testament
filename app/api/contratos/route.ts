import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
const BUCKET = 'documentos-vitais'

// Extension → stored extension (normalise to lowercase)
const ALLOWED_EXTS = new Set([
  'pdf', 'doc', 'docx', 'txt', 'rtf',
  'ppt', 'pptx', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'heic',
  'odt', 'ods', 'odp', 'csv', 'md',
])

function ext(fileName: string): string {
  return (fileName.split('.').pop() ?? '').toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file     = formData.get('file')     as File   | null
    const clientId = formData.get('clientId') as string | null
    const categoria= formData.get('categoria')as string | null

    if (!file || !clientId || !categoria) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede 20 MB' }, { status: 413 })
    }

    const fileExt = ext(file.name)
    if (!ALLOWED_EXTS.has(fileExt)) {
      return NextResponse.json({ error: `Formato .${fileExt} não suportado` }, { status: 415 })
    }

    const supabase = createAdminClient()

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some(b => b.name === BUCKET)) {
      const { error: ce } = await supabase.storage.createBucket(BUCKET, { public: false })
      if (ce && ce.message !== 'Bucket already exists') {
        return NextResponse.json({ error: ce.message }, { status: 500 })
      }
    }

    const timestamp   = Date.now()
    const storagePath = `${clientId}/${categoria}/${timestamp}.${fileExt}`
    const fileName    = file.name || `${categoria}_${timestamp}.${fileExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer      = new Uint8Array(arrayBuffer)

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    return NextResponse.json({ fileName, storagePath, ext: fileExt })

  } catch (err) {
    console.error('[contratos] upload error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
