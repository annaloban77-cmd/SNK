import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapRule } from '../_map'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const category = sp.get('category') || undefined
  const method = sp.get('method') || undefined
  const enabledRaw = sp.get('enabled')
  const enabled = enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (method) where.method = method
  if (enabled !== undefined) where.enabled = enabled
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { description: { contains: search } },
      { gostField: { contains: search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.rule.count({ where }),
    db.rule.findMany({
      where,
      orderBy: { code: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { standard: { select: { id: true, code: true, name: true } } },
    }),
  ])

  return NextResponse.json({
    items: items.map(mapRule),
    total,
    page,
    pageSize,
  })
}

const ALLOWED_CATEGORIES = [
  'stamp',
  'specification',
  'material',
  'cad_attr',
  'format',
  'geometry',
  'semantic',
]
const ALLOWED_METHODS = ['deterministic', 'semantic', 'vision']
const ALLOWED_SEVERITIES = ['high', 'medium', 'low']

/**
 * POST /api/rules — создать новое правило нормоконтроля.
 *
 * Body:
 *   code        string  уникальный код (R-XXX-001)
 *   name        string  короткое название
 *   description string  описание
 *   category    string  stamp | specification | material | cad_attr | format | geometry | semantic
 *   method      string  deterministic | semantic | vision
 *   severity    string  high | medium | low
 *   gostField?  string  ссылка на ГОСТ (например "ГОСТ 2.104-2006")
 *   expression? string  JSON-выражение параметров правила
 *   standardId? string  ID связанного стандарта (опц.)
 */
export async function POST(req: NextRequest) {
  let body: {
    code?: string
    name?: string
    description?: string
    category?: string
    method?: string
    severity?: string
    gostField?: string
    expression?: string
    standardId?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const code = (body.code || '').trim().toUpperCase()
  const name = (body.name || '').trim()
  const description = (body.description || '').trim()
  const category = (body.category || '').trim()
  const method = (body.method || '').trim()
  const severity = (body.severity || 'medium').trim()
  const gostField = (body.gostField || '').trim() || null
  const expression = (body.expression || '').trim() || null
  const standardId = (body.standardId || '').trim() || null

  if (!code) return NextResponse.json({ error: 'Укажите код правила' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Укажите название правила' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Укажите описание правила' }, { status: 400 })
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `Недопустимая категория: ${category}` }, { status: 400 })
  }
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: `Недопустимый метод: ${method}` }, { status: 400 })
  }
  if (!ALLOWED_SEVERITIES.includes(severity)) {
    return NextResponse.json({ error: `Недопустимая критичность: ${severity}` }, { status: 400 })
  }

  // Check uniqueness
  const existing = await db.rule.findUnique({ where: { code }, select: { id: true } })
  if (existing) {
    return NextResponse.json(
      { error: `Правило с кодом ${code} уже существует` },
      { status: 409 }
    )
  }

  // If standardId provided, verify it exists
  if (standardId) {
    const std = await db.standard.findUnique({
      where: { id: standardId },
      select: { id: true },
    })
    if (!std) {
      return NextResponse.json(
        { error: 'Указанный standardId не найден' },
        { status: 400 }
      )
    }
  }

  const rule = await db.rule.create({
    data: {
      code,
      name,
      description,
      category,
      method,
      severity,
      gostField,
      expression,
      standardId,
      enabled: true,
    },
    include: { standard: { select: { id: true, code: true, name: true } } },
  })

  await logAudit({
    organizationId: null,
    action: 'rule.create',
    resourceType: 'rule',
    resourceId: rule.id,
    details: { code, name, category, method, severity, standardId },
  })

  return NextResponse.json(mapRule(rule), { status: 201 })
}
