import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  dwg: 'application/octet-stream',
  dxf: 'application/octet-stream',
  cdw: 'application/octet-stream',
  sldprt: 'application/octet-stream',
  sldasm: 'application/octet-stream',
  slddrw: 'application/octet-stream',
  spw: 'application/octet-stream',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Import db lazily to avoid circular at module load
  const { db } = await import('@/lib/db')
  const doc = await db.document.findUnique({ where: { id }, select: { filePath: true, originalName: true, mimeType: true } })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }
  if (!doc.filePath || !existsSync(doc.filePath)) {
    return NextResponse.json({ error: 'Файл отсутствует на диске (демо-документ)' }, { status: 404 })
  }
  const ext = (doc.originalName.split('.').pop() || '').toLowerCase()
  const mime = doc.mimeType || EXT_TO_MIME[ext] || 'application/octet-stream'
  const buf = await readFile(doc.filePath)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, no-cache',
      'Content-Length': String(buf.length),
    },
  })
}
