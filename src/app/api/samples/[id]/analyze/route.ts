import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAnalyzePipeline } from '@/app/api/_analyze'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SAMPLE_FILES: Record<string, { file: string; title: string; designation: string; format: string }> = {
  'sample-1-kronshtein': {
    file: 'sample-1-kronshtein.png',
    title: 'Кронштейн',
    designation: 'АБВ.301254.001',
    format: 'A3',
  },
  'sample-2-flanets': {
    file: 'sample-2-flanets.png',
    title: 'Фланец',
    designation: 'АБВ.301455.012',
    format: 'A4',
  },
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sampleId } = await params
  const meta = SAMPLE_FILES[sampleId]
  if (!meta) {
    return NextResponse.json({ error: 'Семпл не найден' }, { status: 404 })
  }

  const publicPath = path.join(process.cwd(), 'public', 'samples', meta.file)
  if (!existsSync(publicPath)) {
    return NextResponse.json({ error: `Файл семпла отсутствует: ${meta.file}` }, { status: 404 })
  }

  // Copy file into uploads/ as a new Document
  const uploadsDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const newFileName = `${randomUUID()}-${meta.file}`
  const filePath = path.join(uploadsDir, newFileName)
  const buf = await readFile(publicPath)
  await writeFile(filePath, buf)

  // Optional: link to existing СВ-2025-К-104 project
  const project = await db.project.findUnique({ where: { code: 'СВ-2025-К-104' } })

  const doc = await db.document.create({
    data: {
      name: `${meta.designation}_${meta.title}.png`,
      originalName: meta.file,
      mimeType: 'image/png',
      size: buf.length,
      format: meta.format,
      sourceType: 'scan',
      status: 'new',
      filePath,
      projectId: project?.id ?? null,
      stampJson: null,
      ocrText: null,
    },
  })

  await db.checkLog.create({
    data: {
      documentId: doc.id,
      stage: 'upload',
      status: 'success',
      message: `Семпла «${meta.title}» скопирована как документ`,
    },
  })

  // Allow toggling LLM via query/body
  let runLlm = true
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json()
      if (typeof body?.runLlm === 'boolean') runLlm = body.runLlm
    }
  } catch {
    /* ignore */
  }
  const sp = req.nextUrl.searchParams
  if (sp.get('runLlm') === 'false') runLlm = false

  const result = await runAnalyzePipeline(doc.id, { runLlm })
  return NextResponse.json(result)
}
