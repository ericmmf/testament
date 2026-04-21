import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlaybookData } from '@/lib/types/playbook'

// GET /api/playbook/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Playbook não encontrado', details: error?.message },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

// PATCH /api/playbook/[id]
// Body: { data?: Partial<PlaybookData>, status?: string }
// Used by the advisor review interface to save edits and advance status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as {
      data?: Partial<PlaybookData>
      status?: string
    }

    const supabase = createAdminClient()

    // Fetch current record
    const { data: current, error: fetchError } = await supabase
      .from('playbooks')
      .select('id, status, playbook_data, client_id')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Playbook não encontrado' }, { status: 404 })
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['in_review'],
      in_review: ['draft', 'approved'],
      approved: ['delivered'],
      delivered: [],
    }

    if (body.status && body.status !== current.status) {
      const allowed = validTransitions[current.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Transição inválida: ${current.status} → ${body.status}` },
          { status: 422 }
        )
      }
    }

    // Merge updated playbook_data fields with existing
    const updatedData = body.data
      ? { ...(current.playbook_data as object), ...body.data }
      : current.playbook_data

    const updatePayload: Record<string, unknown> = {
      playbook_data: updatedData,
      updated_at: new Date().toISOString(),
    }

    if (body.status) {
      updatePayload.status = body.status
      // Sync client status when playbook advances
      const clientStatusMap: Record<string, string> = {
        in_review: 'in_review',
        approved: 'approved',
        delivered: 'delivered',
      }
      if (clientStatusMap[body.status]) {
        await supabase
          .from('clients')
          .update({ status: clientStatusMap[body.status] })
          .eq('id', current.client_id)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('playbooks')
      .update(updatePayload)
      .eq('id', id)
      .select('id, status, updated_at')
      .single()

    if (updateError || !updated) {
      console.error('[playbook PATCH] Update error:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar playbook', details: updateError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)

  } catch (err) {
    console.error('[playbook PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
