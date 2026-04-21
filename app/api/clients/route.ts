import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, cpf, email } = body

    if (!full_name?.trim() || !cpf?.trim()) {
      return NextResponse.json(
        { error: 'Nome e CPF são obrigatórios' },
        { status: 400 }
      )
    }

    // Strip CPF formatting — store digits only
    const cpfDigits = cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      return NextResponse.json(
        { error: 'CPF inválido' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('clients')
      .insert({
        full_name: full_name.trim(),
        cpf: cpfDigits,
        email: email?.trim() || null,
        status: 'ingesting',
      })
      .select()
      .single()

    if (error) {
      // Unique violation on CPF
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um cliente cadastrado com este CPF' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Erro ao criar cliente', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: data.id, full_name: data.full_name })
  } catch (err) {
    console.error('[clients] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET /api/clients — list all clients, ordered by creation date desc
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, cpf, email, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[clients GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
