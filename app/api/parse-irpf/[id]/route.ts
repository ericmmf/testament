import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('irpf_uploads')
    .select('id, parse_status, parse_error, parsed_data, file_type, irpf_year, original_filename')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Upload não encontrado' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}
