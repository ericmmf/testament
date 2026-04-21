import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'documentos-vitais'
const EXPIRES_IN = 3600 // 1 hour

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'path obrigatório' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRES_IN)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao gerar URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
