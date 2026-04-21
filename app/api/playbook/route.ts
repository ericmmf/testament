import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePlaybook } from '@/lib/generators/playbook-generator'
import { IRPFData } from '@/lib/types/irpf'

const ADVISOR_ID = 'advisor-default' // MVP: single advisor, no auth yet

// POST /api/playbook
// Body: { clientId: string, uploadId: string }
// Fetches parsed IRPFData from irpf_uploads, runs the generator, persists to playbooks.
// Idempotent: if a playbook already exists for this client, returns the existing one.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, uploadId } = body as { clientId?: string; uploadId?: string }

    if (!clientId || !uploadId) {
      return NextResponse.json(
        { error: 'clientId e uploadId são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check if a playbook already exists for this client
    const { data: existing } = await supabase
      .from('playbooks')
      .select('id, status')
      .eq('client_id', clientId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ playbookId: existing.id, status: existing.status, existing: true })
    }

    // Fetch the parsed IRPF data
    const { data: upload, error: uploadError } = await supabase
      .from('irpf_uploads')
      .select('parsed_data, parse_status, irpf_year, file_type')
      .eq('id', uploadId)
      .eq('client_id', clientId)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: 'Upload não encontrado', details: uploadError?.message },
        { status: 404 }
      )
    }

    if (upload.parse_status !== 'ok' || !upload.parsed_data) {
      return NextResponse.json(
        { error: 'IRPF ainda não processado ou com erro', parse_status: upload.parse_status },
        { status: 422 }
      )
    }

    const irpfData = upload.parsed_data as IRPFData
    const playbookData = generatePlaybook(irpfData, clientId, ADVISOR_ID)

    const { data: inserted, error: insertError } = await supabase
      .from('playbooks')
      .insert({
        client_id: clientId,
        status: 'draft',
        playbook_data: playbookData,
        irpf_years_loaded: playbookData.irpfYearsLoaded,
      })
      .select('id, status')
      .single()

    if (insertError || !inserted) {
      console.error('[playbook] Insert error full object:', JSON.stringify(insertError, null, 2))
      return NextResponse.json(
        {
          error: 'Erro ao criar playbook',
          details: insertError?.message,
          code: insertError?.code,
          hint: insertError?.hint,
        },
        { status: 500 }
      )
    }

    // Update client status to 'in_review' if currently 'draft'
    await supabase
      .from('clients')
      .update({ status: 'in_review' })
      .eq('id', clientId)
      .eq('status', 'draft')

    return NextResponse.json(
      { playbookId: inserted.id, status: inserted.status, existing: false },
      { status: 201 }
    )

  } catch (err) {
    console.error('[playbook] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// GET /api/playbook?clientId=xxx
// Returns the playbook for a client.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Playbook não encontrado' }, { status: 404 })
  }

  return NextResponse.json(data)
}
