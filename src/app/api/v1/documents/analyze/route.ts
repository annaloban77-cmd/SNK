import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapDocument } from '@/app/api/_map'
import { runAnalyzePipeline } from '@/app/api/_analyze'
import { authenticateApiKey, requireScope } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ===== Security limits =====
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB — отклонять большие файлы ПЕРЕД скачиванием
const MAX_FILE_SIZE_AFTER = 55 * 1024 * 1024 // 55 MB — двойная проверка после скачивания
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'application/dxf', 'application/acad', 'application/octet-stream']
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'svg', 'dxf', 'dwg', 'cdw', 'sldprt', 'sldasm', 'slddrw', 'spw'])

/**
 * Скачать файл с проверкой content-length ПЕРЕД полным скачиванием.
 * Защита от OOM: отклоняет файлы > MAX_FILE_SIZE.
 */
async function fetchToFile(url: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  // 1. HEAD-запрос для проверки content-length без скачивания тела
  let contentType = 'application/octet-stream'
  let declaredSize: number | null = null

  try {
    const headRes = await fetch(url, { method: 'HEAD' })
    if (headRes.ok) {
      contentType = headRes.headers.get('content-type') || contentType
      const cl = headRes.headers.get('content-length')
      if (cl) declaredSize = parseInt(cl, 10)
    }
  } catch {
    // Некоторые серверы не поддерживают HEAD — продолжаем с GET
  }

  // 2. Проверка размера ПЕРЕД скачиванием (если сервер сообщил content-length)
  if (declaredSize !== null && declaredSize > MAX_FILE_SIZE) {
    throw new Error(`Файл слишком большой: ${declaredSize} байт (макс. ${MAX_FILE_SIZE}). Отклонено до скачивания.`)
  }

  // 3. Проверка MIME type (если сервер сообщил в HEAD)
  if (!ALLOWED_MIME_PREFIXES.some((p) => contentType.startsWith(p)) && contentType !== 'application/octet-stream') {
    throw new Error(`Недопустимый тип файла: ${contentType}. Разрешены: изображения, PDF, CAD.`)
  }

  // 4. Скачивание
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось скачать файл: HTTP ${res.status}`)

  contentType = res.headers.get('content-type') || contentType

  // 5. Двойная проверка размера ПОСЛЕ скачивания
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > MAX_FILE_SIZE_AFTER) {
    throw new Error(`Файл слишком большой после скачивания: ${buffer.length} байт (макс. ${MAX_FILE_SIZE_AFTER}).`)
  }

  // 6. Determine extension from content-type
  let ext = 'bin'
  if (contentType.includes('image/png')) ext = 'png'
  else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = 'jpg'
  else if (contentType.includes('image/webp')) ext = 'webp'
  else if (contentType.includes('application/pdf')) ext = 'pdf'
  else if (contentType.includes('image/svg')) ext = 'svg'
  else if (contentType.includes('application/dxf') || contentType.includes('application/acad')) ext = 'dxf'
  else {
    // Try from URL path
    const u = new URL(url)
    const urlExt = u.pathname.split('.').pop() || ''
    if (urlExt) ext = urlExt.toLowerCase()
  }

  // 7. Финальная проверка расширения (защита от загрузки исполняемых файлов)
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Недопустимое расширение файла: .${ext}. Разрешены: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}.`)
  }

  return { buffer, mimeType: contentType, ext }
}

function sourceTypeFromExt(ext: string): string {
  switch (ext) {
    case 'pdf': return 'pdf'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'svg': return 'scan'
    case 'dwg': return 'dwg'
    case 'dxf': return 'dxf'
    case 'cdw': return 'cdw'
    case 'sldprt': return 'sldprt'
    case 'sldasm': return 'sldasm'
    case 'slddrw': return 'slddrw'
    case 'spw': return 'spw'
    default: return 'scan'
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  if (!requireScope(auth, 'write')) {
    return NextResponse.json({ error: 'Недостаточно прав: требуется scope "write"' }, { status: 403 })
  }

  let body: { imageUrl?: string; runLlm?: boolean; name?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  if (!body.imageUrl || !/^https?:\/\//.test(body.imageUrl)) {
    return NextResponse.json({ error: 'Параметр imageUrl обязателен (http(s)://)' }, { status: 400 })
  }

  try {
    // Download the file (с проверкой размера и MIME)
    const { buffer, mimeType, ext } = await fetchToFile(body.imageUrl)
    const sourceType = sourceTypeFromExt(ext)

    // Save to uploads/
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${randomUUID()}.${ext}`
    const filePath = path.join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    // Format: null если не определён (P5: честный формат, без подмены 'unknown')
    // Детектор запускается в analyze pipeline (detectFormatFromImage / detectFormatFromCad)
    const format = null

    // Multi-tenant: проект должен принадлежать организации API-ключа
    const project = await db.project.findFirst({
      where: { organizationId: auth.organizationId ?? null },
      select: { id: true },
    })

    const originalName = body.name || body.imageUrl.split('/').pop() || `api-upload.${ext}`
    const doc = await db.document.create({
      data: {
        name: originalName,
        originalName,
        mimeType,
        size: buffer.length,
        format,
        sourceType,
        status: 'new',
        filePath,
        projectId: project?.id ?? null,
        // Multi-tenant: документ привязан к организации API-ключа
        organizationId: auth.organizationId ?? null,
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
        message: `Загружен через API из ${body.imageUrl} (${buffer.length} байт)`,
      },
    })

    await logAudit({
      organizationId: auth.organizationId ?? null,
      action: 'api.document.uploaded',
      resourceType: 'document',
      resourceId: doc.id,
      details: { imageUrl: body.imageUrl, sourceType, format, size: buffer.length },
    })

    // Run analyze pipeline
    const result = await runAnalyzePipeline(doc.id, { runLlm: body.runLlm !== false })

    await logAudit({
      organizationId: auth.organizationId ?? null,
      action: 'api.document.analyzed',
      resourceType: 'document',
      resourceId: doc.id,
      details: {
        runLlm: body.runLlm !== false,
        status: 'status' in result ? result.status : 'failed',
        issuesCount: 'issues' in result ? result.issues.length : 0,
      },
    })

    return NextResponse.json({
      document: mapDocument(doc),
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // OOM/file-size errors → 400, not 500
    if (msg.includes('слишком большой') || msg.includes('Недопустимый') || msg.includes('Недопустимое расширение')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'Не удалось обработать документ: ' + msg }, { status: 500 })
  }
}
