import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '../_map'
import type { DashboardStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { name: string; color: string }> = {
  new: { name: 'Новые', color: '#64748b' },
  processing: { name: 'В проверке', color: '#f59e0b' },
  analyzed: { name: 'Проверены', color: '#10b981' },
  failed: { name: 'Ошибка', color: '#ef4444' },
}

const SEVERITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
}

const SEVERITY_LABEL: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
}

export async function GET() {
  const [
    totalDocuments,
    analyzedDocuments,
    processingDocuments,
    pendingDocuments,
    totalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    confirmedIssues,
    fixedIssues,
    documents,
    issues,
    recentDocsRaw,
    analyzedDocs,
    passedCount,
    standardsCount,
    rulesCount,
    categoriesCount,
  ] = await Promise.all([
    db.document.count(),
    db.document.count({ where: { status: 'analyzed' } }),
    db.document.count({ where: { status: 'processing' } }),
    db.document.count({ where: { status: 'new' } }),
    db.issue.count(),
    db.issue.count({ where: { severity: 'high' } }),
    db.issue.count({ where: { severity: 'medium' } }),
    db.issue.count({ where: { severity: 'low' } }),
    db.issue.count({ where: { status: 'confirmed' } }),
    db.issue.count({ where: { status: 'fixed' } }),
    db.document.findMany({ select: { status: true, format: true, createdAt: true, issueCount: true } }),
    db.issue.findMany({ select: { severity: true, code: true, title: true, rule: { select: { category: true } } } }),
    db.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { project: { select: { id: true, code: true, name: true } } },
    }),
    db.document.findMany({
      where: { status: 'analyzed', NOT: { checkDuration: null } },
      select: { checkDuration: true },
    }),
    db.document.count({ where: { status: 'analyzed', highCount: 0 } }),
    db.standard.count(),
    db.rule.count({ where: { enabled: true } }),
    db.standard.findMany({ where: { NOT: { category: null } }, select: { category: true }, distinct: ['category'] }),
  ])

  const sumDur = analyzedDocs.reduce((acc, d) => acc + (d.checkDuration ?? 0), 0)
  const avgCheckDurationMs = analyzedDocs.length ? Math.round(sumDur / analyzedDocs.length) : null

  const passRate = analyzedDocuments ? Math.round((passedCount / analyzedDocuments) * 100) : 0

  const issuesBySeverity = (['high', 'medium', 'low'] as const).map((sev) => ({
    name: SEVERITY_LABEL[sev],
    value: issues.filter((i) => i.severity === sev).length,
    color: SEVERITY_COLORS[sev],
  }))

  const statusKeys = ['new', 'processing', 'analyzed', 'failed']
  const documentsByStatus = statusKeys.map((k) => ({
    name: STATUS_LABELS[k]?.name ?? k,
    value: documents.filter((d) => d.status === k).length,
    color: STATUS_LABELS[k]?.color ?? '#94a3b8',
  }))

  const formatMap = new Map<string, number>()
  for (const d of documents) {
    const f = d.format || 'unknown'
    formatMap.set(f, (formatMap.get(f) ?? 0) + 1)
  }
  const documentsByFormat = Array.from(formatMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const categoryMap = new Map<string, number>()
  for (const i of issues) {
    const cat = i.rule?.category || 'semantic'
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1)
  }
  const issuesByCategory = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const today = new Date()
  const days: { date: string; count: number; issues: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    const dayDocs = documents.filter((doc) => {
      const c = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)
      return c >= d && c < next
    })
    const count = dayDocs.length
    const issueSum = dayDocs.reduce((acc, doc) => acc + (doc.issueCount ?? 0), 0)
    days.push({
      date: d.toISOString().slice(0, 10),
      count,
      issues: issueSum,
    })
  }

  const codeMap = new Map<string, { code: string; title: string; severity: string; count: number }>()
  for (const i of issues) {
    const key = i.code
    const existing = codeMap.get(key)
    if (existing) {
      existing.count++
    } else {
      codeMap.set(key, {
        code: i.code,
        title: i.title,
        severity: i.severity,
        count: 1,
      })
    }
  }
  const topIssues = Array.from(codeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => ({
      code: t.code,
      title: t.title,
      count: t.count,
      severity: t.severity as 'high' | 'medium' | 'low',
    }))

  const recentDocuments = recentDocsRaw.map(mapDocument)

  const stats: DashboardStats = {
    totalDocuments,
    analyzedDocuments,
    processingDocuments,
    pendingDocuments,
    totalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    confirmedIssues,
    fixedIssues,
    avgCheckDurationMs,
    passRate,
    issuesBySeverity,
    documentsByStatus,
    documentsByFormat,
    issuesByCategory,
    checksLast14Days: days,
    recentDocuments,
    topIssues,
    // Extension (Task 3-a) — expose knowledge base size
    standardsCount,
    rulesCount,
    categoriesCount: categoriesCount.length,
  }

  return NextResponse.json(stats)
}
