import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseDEC } from '@/lib/parsers/dec-parser'
import { extractIRPFFromPDF } from '@/lib/parsers/pdf-extractor'
import { IRPFData } from '@/lib/types/irpf'
import { SupabaseClient } from '@supabase/supabase-js'

// Runs in the background after the route has already responded.
// Updates the irpf_uploads record and advances the client status.
async function runExtraction(
  supabase: SupabaseClient,
  uploadId: string,
  clientId: string,
  fileBuffer: ArrayBuffer,
  isDec: boolean,
) {
  let parsedData: IRPFData
  try {
    parsedData = isDec
      ? await parseDEC(fileBuffer)
      : await extractIRPFFromPDF(fileBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse-irpf] Background extraction error:', message, err)
    await supabase
      .from('irpf_uploads')
      .update({
        parse_status: 'error',
        parse_error: message,
      })
      .eq('id', uploadId)
    return
  }

  await supabase
    .from('irpf_uploads')
    .update({ parsed_data: parsedData, parse_status: 'ok' })
    .eq('id', uploadId)

  await supabase
    .from('clients')
    .update({ status: 'draft' })
    .eq('id', clientId)
    .eq('status', 'ingesting')

  console.log('[parse-irpf] Extraction complete for uploadId:', uploadId)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const irpfYear = formData.get('irpfYear') as string | null
    const force = formData.get('force') === 'true'   // re-upload: wipe existing record

    if (!file || !clientId || !irpfYear) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes: file, clientId, irpfYear' },
        { status: 400 }
      )
    }

    const year = parseInt(irpfYear, 10)
    if (isNaN(year) || year < 2015 || year > 2100) {
      return NextResponse.json(
        { error: 'irpfYear inválido' },
        { status: 400 }
      )
    }

    const filename = file.name.toLowerCase()
    const isDec = filename.endsWith('.dec')
    const isPdf = filename.endsWith('.pdf')

    if (!isDec && !isPdf) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado. Envie um .DEC ou .PDF.' },
        { status: 400 }
      )
    }

    const fileType = isDec ? 'dec' : 'pdf'
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabase = createAdminClient()

    // force=true (re-upload from playbook page): delete any existing record for this
    // (client, year, type) so the fresh upload creates a clean record.
    if (force) {
      const { data: existing } = await supabase
        .from('irpf_uploads')
        .select('id, storage_path')
        .eq('client_id', clientId)
        .eq('irpf_year', year)
        .eq('file_type', fileType)
        .maybeSingle()

      if (existing) {
        // Delete stale storage object if present
        if (existing.storage_path) {
          await supabase.storage.from('irpf-files').remove([existing.storage_path])
        }
        await supabase.from('irpf_uploads').delete().eq('id', existing.id)
        console.log('[parse-irpf] force=true — deleted existing record:', existing.id)
      }
    }

    // Insert initial record immediately
    const { data: uploadRecord, error: insertError } = await supabase
      .from('irpf_uploads')
      .insert({
        client_id: clientId,
        irpf_year: year,
        file_type: fileType,
        storage_path: '',
        original_filename: file.name,
        parse_status: 'pending',
      })
      .select()
      .single()

    // Unique constraint violation — a record for this (client, year, type) already exists.
    // Recover the existing record so the client can resume polling.
    if (insertError?.code === '23505') {
      const { data: existing } = await supabase
        .from('irpf_uploads')
        .select('id, file_type, irpf_year, parse_status')
        .eq('client_id', clientId)
        .eq('irpf_year', year)
        .eq('file_type', fileType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        // If previous attempt failed, reset and re-run extraction
        if (existing.parse_status === 'error') {
          console.log('[parse-irpf] Previous attempt failed — resetting and re-processing:', existing.id)
          await supabase
            .from('irpf_uploads')
            .update({ parse_status: 'pending', parse_error: null })
            .eq('id', existing.id)
          await runExtraction(supabase, existing.id, clientId, arrayBuffer, isDec)
          return NextResponse.json({
            uploadId: existing.id,
            fileType: existing.file_type,
            irpfYear: existing.irpf_year,
            status: 'processing',
          })
        }
        console.log('[parse-irpf] Duplicate upload — returning existing record:', existing.id)
        return NextResponse.json({
          uploadId: existing.id,
          fileType: existing.file_type,
          irpfYear: existing.irpf_year,
          status: existing.parse_status,
        })
      }
    }

    if (insertError || !uploadRecord) {
      console.error('[parse-irpf] Supabase insert error:', insertError)
      return NextResponse.json(
        { error: 'Erro ao salvar registro no banco', details: insertError?.message },
        { status: 500 }
      )
    }

    // Upload file to storage
    const storagePath = `${clientId}/${uploadRecord.id}/${file.name}`
    const { error: storageError } = await supabase.storage
      .from('irpf-files')
      .upload(storagePath, buffer, {
        contentType: isPdf ? 'application/pdf' : 'application/octet-stream',
        upsert: false,
      })

    if (storageError) {
      console.error('[parse-irpf] Storage upload error:', storageError)
      await supabase
        .from('irpf_uploads')
        .update({ parse_status: 'error', parse_error: storageError.message })
        .eq('id', uploadRecord.id)
      return NextResponse.json(
        { error: 'Erro ao armazenar arquivo', details: storageError.message },
        { status: 500 }
      )
    }

    // Update storage path on the record
    await supabase
      .from('irpf_uploads')
      .update({ storage_path: storagePath })
      .eq('id', uploadRecord.id)

    // Await extraction synchronously — background void tasks are killed when the
    // route handler returns in Next.js dev / Node.js environments, causing ECONNRESET
    // on any outbound fetch (e.g. Anthropic API). Keeping the connection open for the
    // full duration is the correct approach for local dev; for serverless deploy, use
    // a proper queue or Vercel's waitUntil().
    await runExtraction(supabase, uploadRecord.id, clientId, arrayBuffer, isDec)

    return NextResponse.json({
      uploadId: uploadRecord.id,
      fileType,
      irpfYear: year,
      status: 'processing',
    })

  } catch (err) {
    console.error('[parse-irpf] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
