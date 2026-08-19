import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '../_map'

export const dynamic = 'force-dynamic'

const WATCHDOG_TIMEOUT_MS = 5 * 60 * 1000 // 5 минут

/**
 * Watchdog: документы со статусом 'processing', которые не обновлялись более 5 минут,
 * помечаются как 'failed' с записью в CheckLog.
 * Запускается при каждом запросе списка документов (cheap query).
 */
async function runWatchdog() {
  try {
    const cutoff = new Date(Date.now() - WATCHDOG_TIMEOUT_MS)
    const stuck = await db.document.findMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      select: { id: true },
    })
    if (stuck.length === 0) return
    await db.document.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: { status: 'failed' },
    })
    await db.checkLog.createMany({
      data: stuck.map((s) => ({
        documentId: s.id,
        stage: 'watchdog',
        status: 'failed',
        message: 'Превышено время ожидания (5 мин)',
      })),
    })
  } catch (e) {
    console.error('watchdog failed:', e)
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const status = sp.get('status') || undefined
  const format = sp.get('format') || undefined
  const sourceType = sp.get('sourceType') || undefined
  const projectId = sp.get('projectId') || undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  // Watchdog: detects stuck 'processing' documents and marks them as 'failed'
  await runWatchdog()

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  // format=none — специальное значение: документы без определённого формата (format IS NULL)
  // (P5: честный формат — показываем их как отдельную группу, не подменяем на 'A3')
  if (format === 'none') {
    where.format = null
  } else if (format) {
    where.format = format
  }
  if (sourceType) where.sourceType = sourceType
  // projectId=none — special value meaning "documents without a project"
  if (projectId === 'none') {
    where.projectId = null
  } else if (projectId) {
    where.projectId = projectId
  }

  // For search we need to also look inside stampJson.designation. SQLite JSON_EXTRACT is supported
  // by Prisma's `queryRaw`, but for simplicity we fetch filtered docs and apply search in JS.
  // To keep memory bounded we fetch only id/name/stampJson for filtering when search is provided.
  let filteredIds: string[] | null = null
  if (search) {
    const all = await db.document.findMany({
      where,
      select: { id: true, name: true, originalName: true, stampJson: true },
    })
    const q = search.toLowerCase()
    filteredIds = all
      .filter((d) => {
        if (d.name?.toLowerCase().includes(q)) return true
        if (d.originalName?.toLowerCase().includes(q)) return true
        if (d.stampJson) {
          try {
            const stamp = JSON.parse(d.stampJson) as { designation?: string; name?: string }
            if (stamp.designation?.toLowerCase().includes(q)) return true
            if (stamp.name?.toLowerCase().includes(q)) return true
          } catch {
            /* ignore */
          }
        }
        return false
      })
      .map((d) => d.id)
    if (filteredIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, pageSize })
    }
  }

  const finalWhere = filteredIds ? { ...where, id: { in: filteredIds } } : where

  const [total, items] = await Promise.all([
    db.document.count({ where: finalWhere }),
    db.document.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { project: { select: { id: true, code: true, name: true } } },
    }),
  ])

  return NextResponse.json({
    items: items.map(mapDocument),
    total,
    page,
    pageSize,
  })
}
