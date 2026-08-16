import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST /api/bench/feedback — добавить документ в бенч
// Тело: { documentId: string, category: 'correct' | 'with_errors', findings?: { code: string, title: string, severity: string, field: string }[] }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentId, category, findings } = body

  if (!documentId) {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { issues: true },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Генерируем код семпла
  const prefix = category === 'correct' ? 'F-' : 'FE-'
  const count = await db.benchSample.count({ where: { code: { startsWith: prefix } } })
  const code = `${prefix}${String(count + 1).padStart(3, '0')}`

  // Копируем файл в bench/dynamic/
  const dynamicDir = '/home/z/my-project/public/bench/dynamic'
  await mkdir(dynamicDir, { recursive: true })
  const ext = doc.filePath.split('.').pop() || 'png'
  const filePath = `/bench/dynamic/${code}.${ext}`
  const fullPath = path.join('/home/z/my-project/public', filePath)

  // Копируем файл
  if (existsSync(doc.filePath)) {
    const { copyFile } = await import('fs/promises')
    await copyFile(doc.filePath, fullPath)
  }

  // Подготавливаем expected findings
  let expectedFindings: string | null = null
  let expectedCount = 0, expectedHigh = 0, expectedMedium = 0, expectedLow = 0
  let expectedCategories: string[] = []

  if (category === 'with_errors' && findings && findings.length > 0) {
    expectedCount = findings.length
    expectedHigh = findings.filter((f: any) => f.severity === 'high').length
    expectedMedium = findings.filter((f: any) => f.severity === 'medium').length
    expectedLow = findings.filter((f: any) => f.severity === 'low').length
    expectedCategories = [...new Set(findings.map((f: any) => f.code.split('-')[1]?.toLowerCase()))] as string[]
    expectedFindings = JSON.stringify({ code, sample: code, findings })
  }

  // Создаём BenchSample
  const sample = await db.benchSample.create({
    data: {
      code,
      title: `${doc.name} (feedback: ${category})`,
      category,
      documentType: 'drawing',
      format: doc.format || 'A3',
      sourceType: doc.sourceType,
      filePath,
      expectedFindings,
      expectedCount,
      expectedHigh,
      expectedMedium,
      expectedLow,
      expectedCategories: JSON.stringify(expectedCategories),
      isActive: true,
    },
  })

  // Сохраняем expected JSON
  if (expectedFindings) {
    const expectedDir = '/home/z/my-project/public/bench/expected'
    await mkdir(expectedDir, { recursive: true })
    await writeFile(path.join(expectedDir, `${code}.json`), expectedFindings)
  }

  await logAudit({
    action: 'bench.feedback',
    resourceType: 'bench',
    resourceId: sample.id,
    details: { code, documentId, category, expectedCount },
  })

  return NextResponse.json({
    success: true,
    code,
    sampleId: sample.id,
    message: `Семпл ${code} добавлен в бенч (категория: ${category === 'correct' ? 'эталон' : 'с ошибками'})`,
  })
}
