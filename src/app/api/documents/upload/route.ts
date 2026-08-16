import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '@/app/api/_map'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

function extToSourceType(name: string): {
  sourceType: string
  mimeType: string
} {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'pdf':
      return { sourceType: 'pdf', mimeType: 'application/pdf' }
    case 'png':
      return { sourceType: 'scan', mimeType: 'image/png' }
    case 'jpg':
    case 'jpeg':
      return { sourceType: 'scan', mimeType: 'image/jpeg' }
    case 'svg':
      return { sourceType: 'scan', mimeType: 'image/svg+xml' }
    case 'dwg':
      return { sourceType: 'dwg', mimeType: 'application/octet-stream' }
    case 'dxf':
      return { sourceType: 'dxf', mimeType: 'application/octet-stream' }
    case 'cdw':
      return { sourceType: 'cdw', mimeType: 'application/octet-stream' }
    case 'sldprt':
      return { sourceType: 'sldprt', mimeType: 'application/octet-stream' }
    case 'sldasm':
      return { sourceType: 'sldasm', mimeType: 'application/octet-stream' }
    case 'slddrw':
      return { sourceType: 'slddrw', mimeType: 'application/octet-stream' }
    case 'spw':
      return { sourceType: 'spw', mimeType: 'application/octet-stream' }
    default:
      return { sourceType: 'scan', mimeType: 'application/octet-stream' }
  }
}

// Compute format (A0..A4) from image dimensions using aspect ratios of ISO 216
async function computeFormat(filePath: string, mimeType: string): Promise<string> {
  if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) return 'unknown'
  try {
    const meta = await sharp(filePath).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (!w || !h) return 'unknown'
    const ratio = Math.max(w, h) / Math.min(w, h) // >1, A-series ratio ~1.414
    const isPortrait = h > w
    // area-based detection vs known formats (A4=210x297, A3=297x420, A2=420x594, A1=594x841, A0=841x1189)
    const longer = Math.max(w, h)
    const shorter = Math.min(w, h)
    // Map by long side (approx, at ~72 DPI for screen samples)
    if (Math.abs(ratio - Math.SQRT2) > 0.18) return 'unknown'
    // Heuristic by long side px
    if (isPortrait) {
      if (longer >= 1700 && longer < 2400) return 'A3'
      if (longer >= 1100 && longer < 1700) return 'A4'
      if (longer >= 2400 && longer < 3400) return 'A2'
      if (longer >= 3400 && longer < 4800) return 'A1'
      if (longer >= 4800) return 'A0'
    } else {
      if (longer >= 1700 && longer < 2400) return 'A3'
      if (longer >= 1100 && longer < 1700) return 'A4'
      if (longer >= 2400 && longer < 3400) return 'A2'
      if (longer >= 3400 && longer < 4800) return 'A1'
      if (longer >= 4800) return 'A0'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Файл не передан (поле "file")' }, { status: 400 })
    }
    const projectId = (fd.get('projectId') as string | null) || undefined
    const explicitSourceType = (fd.get('sourceType') as string | null) || undefined
    const explicitFormat = (fd.get('format') as string | null) || undefined

    const { sourceType: detectedSource, mimeType: detectedMime } = extToSourceType(file.name)
    const sourceType = explicitSourceType || detectedSource
    const mimeType = file.type || detectedMime

    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const safeName = file.name.replace(/[^a-zA-ZА-Яа-я0-9._-]+/g, '_')
    const fileName = `${randomUUID()}-${safeName}`
    const filePath = path.join(uploadsDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    let format = explicitFormat || 'unknown'
    if (!explicitFormat) {
      format = await computeFormat(filePath, mimeType)
    }

    const name = projectId
      ? `${projectId}_${file.name}`
      : file.name

    const doc = await db.document.create({
      data: {
        name,
        originalName: file.name,
        mimeType,
        size: file.size,
        format: format || 'unknown',
        sourceType,
        status: 'new',
        filePath,
        projectId: projectId ?? null,
        stampJson: null,
        ocrText: null,
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    })

    await db.checkLog.create({
      data: {
        documentId: doc.id,
        stage: 'upload',
        status: 'success',
        message: `Загружен файл ${file.name} (${file.size} байт)`,
      },
    })

    return NextResponse.json({ document: mapDocument(doc) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Не удалось сохранить файл: ' + msg }, { status: 500 })
  }
}
