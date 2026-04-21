import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlaybookPDFDocument } from '@/lib/pdf/PlaybookPDFDocument'
import type { PDFSection } from '@/lib/pdf/types'
import { PlaybookData } from '@/lib/types/playbook'

const ALL_SECTIONS: PDFSection[] = [
  'briefing',
  'dadosPessoais',
  'imoveis',
  'ativosFinanceiros',
  'creditos',
  'participacoesSocietarias',
  'documentos',
]

type PlaybookRow = {
  id: string
  playbook_data: PlaybookData
  status: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { sections?: PDFSection[]; playbookData?: PlaybookData }
    const sections: PDFSection[] = body.sections ?? ALL_SECTIONS

    let playbookData: PlaybookData

    if (body.playbookData) {
      // Frontend passed current UI state — use directly (reflects unsaved edits)
      playbookData = body.playbookData
    } else {
      // Fall back to Supabase state
      const supabase = createAdminClient()
      const { data: row, error } = await supabase
        .from('playbooks')
        .select('id, playbook_data, status')
        .eq('id', id)
        .single<PlaybookRow>()

      if (error || !row) {
        return NextResponse.json({ error: error?.message ?? 'Playbook não encontrado' }, { status: 404 })
      }
      playbookData = row.playbook_data
    }

    const buffer = await renderToBuffer(
      React.createElement(PlaybookPDFDocument, { data: playbookData, sections })
    )

    const fileName = `testament_${playbookData.dadosPessoais.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    console.error('[pdf] generation error:', err)
    return NextResponse.json({ error: 'Erro na geração do PDF' }, { status: 500 })
  }
}
