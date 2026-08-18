import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

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

const ALLOWED_STAGES = ['concept', 'design', 'production', 'review', 'archive']

/**
 * POST /api/projects — создать проект / комплект документации.
 * Body:
 *   code        string  уникальный код проекта (Судно-проект-2026)
 *   name        string  наименование
 *   description string  описание (опц.)
 *   stage       string  concept | design | production | review | archive (опц., по умолчанию "design")
 */
export async function POST(req: NextRequest) {
  let body: {
    code?: string
    name?: string
    description?: string
    stage?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const code = (body.code || '').trim()
  const name = (body.name || '').trim()
  const description = (body.description || '').trim() || null
  const stage = (body.stage || 'design').trim()

  if (!code) return NextResponse.json({ error: 'Укажите код проекта' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Укажите название проекта' }, { status: 400 })
  if (!ALLOWED_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `Недопустимая стадия: ${stage}` },
      { status: 400 }
    )
  }

  const existing = await db.project.findUnique({ where: { code }, select: { id: true } })
  if (existing) {
    return NextResponse.json(
      { error: `Проект с кодом ${code} уже существует` },
      { status: 409 }
    )
  }

  const project = await db.project.create({
    data: {
      code,
      name,
      description,
      stage,
      status: 'active',
    },
    include: { _count: { select: { documents: true } } },
  })

  await logAudit({
    organizationId: null,
    action: 'project.create',
    resourceType: 'project',
    resourceId: project.id,
    details: { code, name, stage },
  })

  return NextResponse.json(
    {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      stage: project.stage,
      status: project.status,
      documentsCount: project._count.documents,
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : new Date(project.createdAt).toISOString(),
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : new Date(project.updatedAt).toISOString(),
    },
    { status: 201 }
  )
}
