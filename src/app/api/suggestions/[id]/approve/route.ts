import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST /api/suggestions/[id]/approve — одобрить и применить
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const suggestion = await db.knowledgeSuggestion.findUnique({ where: { id } })
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (suggestion.type === 'bench_sample' && suggestion.payload) {
    // Создаём BenchSample
    const payload = JSON.parse(suggestion.payload)
    const code = payload.code || `F-${Date.now()}`
    await db.benchSample.create({
      data: {
        code, title: suggestion.title, category: payload.category || 'correct',
        tier: 'realistic', documentType: 'drawing', format: 'A3', sourceType: 'scan',
        filePath: payload.filePath || '/bench/dynamic/placeholder.png',
        expectedFindings: JSON.stringify(payload.expectedFindings || []),
        expectedCount: (payload.expectedFindings || []).length,
        isActive: true,
      },
    })
  } else if (suggestion.type === 'new_rule' && suggestion.payload) {
    // Создаём Rule (черновик)
    const payload = JSON.parse(suggestion.payload)
    const draft = payload.draftRule || {}
    const code = draft.code || `R-EXP-${Date.now()}`
    await db.rule.upsert({
      where: { code },
      update: {},
      create: {
        code, name: draft.name || suggestion.title, description: draft.description || suggestion.description || '',
        category: 'semantic', method: 'semantic', severity: draft.severity || 'medium',
        gostField: draft.gostField || null, enabled: true,
      },
    })
  }

  await db.knowledgeSuggestion.update({ where: { id }, data: { status: 'approved' } })
  await logAudit({ action: 'suggestion.approved', resourceType: 'suggestion', resourceId: id })
  return NextResponse.json({ success: true, message: 'Предложение одобрено и применено' })
}
