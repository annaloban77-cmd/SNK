import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '../_map'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const status = sp.get('status') || undefined
  const format = sp.get('format') || undefined
  const sourceType = sp.get('sourceType') || undefined
  const projectId = sp.get('projectId') || undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (format) where.format = format
  if (sourceType) where.sourceType = sourceType
  if (projectId) where.projectId = projectId

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
