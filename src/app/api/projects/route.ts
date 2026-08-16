import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { documents: true } } },
  })

  return NextResponse.json({
    items: projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      stage: p.stage,
      status: p.status,
      documentsCount: p._count.documents,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt).toISOString(),
    })),
  })
}
