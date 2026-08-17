import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// GET /api/suggestions — список предложений
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'new'
  const type = req.nextUrl.searchParams.get('type')
  const where: any = { status }
  if (type) where.type = type
  const items = await db.knowledgeSuggestion.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 })
  return NextResponse.json({ items: items.map(s => ({ ...s, payload: s.payload ? JSON.parse(s.payload) : null })) })
}

// POST /api/suggestions — создать предложение (из отклонённого FP/FN)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { issueId, type } = body
  if (!issueId || !type) return NextResponse.json({ error: 'issueId and type required' }, { status: 400 })

  const issue = await db.issue.findUnique({ where: { id: issueId }, include: { document: true } })
  if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

  let title = '', description = '', payload: any = null

  if (type === 'bench_sample') {
    // Отклонённый FP → предложение добавить в бенч
    title = `Семпл в бенч: ${issue.code} на ${issue.document?.name || ''}`
    description = `Отклонённое замечание → добавить как correct семпл (система не должна была найти это)`
    payload = { code: `F-${Date.now()}`, category: 'correct', expectedFindings: [] }
  } else if (type === 'new_rule') {
    // Экспертное замечание → предложение создать правило
    title = `Новое правило для: ${issue.title}`
    description = `Замечание от эксперта не покрыто существующими правилами. Код: ${issue.code}`
    payload = { draftRule: { code: issue.code, name: issue.title, description: issue.description, severity: issue.severity } }
  } else if (type === 'reference_entry') {
    // Найденный материал/крепёж не в справочнике → добавить
    title = `Запись справочника: ${issue.field || 'неизвестно'}`
    description = `Значение "${issue.evidence || ''}" не найдено в справочнике`
    payload = { type: 'reference', value: issue.evidence }
  }

  const suggestion = await db.knowledgeSuggestion.create({
    data: { type, title, description, payload: JSON.stringify(payload), issueId, status: 'new' },
  })

  await logAudit({ action: 'suggestion.created', resourceType: 'suggestion', resourceId: suggestion.id, details: { type, issueId } })
  return NextResponse.json({ success: true, suggestion })
}
