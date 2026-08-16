// CSV отчёт нормоконтроля — для Excel/Numbers
import { db } from '@/lib/db'

export interface CsvReportData {
  document: {
    name: string
    designation: string | null
    format: string
    sourceType: string
  }
  organization: string
  issues: {
    code: string
    title: string
    severity: string
    status: string
    field: string | null
    gostRef: string | null
    recommendation: string | null
    description: string
  }[]
  stamp: any
  checkDuration: number | null
}

export async function generateCsvReport(documentId: string): Promise<{ csv: string; filename: string }> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { issues: { orderBy: { severity: 'asc' } } },
  })
  if (!doc) throw new Error('Документ не найден')

  const org = await db.organization.findFirst()
  const orgName = org?.name || 'НК-Контроль'

  const stamp = doc.stampJson ? JSON.parse(doc.stampJson) : {}
  const issues = doc.issues.map(i => ({
    code: i.code,
    title: i.title,
    severity: i.severity,
    status: i.status,
    field: i.field,
    gostRef: i.gostRef,
    recommendation: i.recommendation,
    description: i.description,
  }))

  const data: CsvReportData = {
    document: {
      name: doc.name,
      designation: stamp.designation || null,
      format: doc.format,
      sourceType: doc.sourceType,
    },
    organization: orgName,
    issues,
    stamp,
    checkDuration: doc.checkDuration,
  }

  const csv = buildCsv(data)
  const filename = `акт_нормоконтроля_${doc.name.replace(/[^А-Яа-я0-9]/gi, '_')}.csv`
  return { csv, filename }
}

function buildCsv(data: CsvReportData): string {
  const lines: string[] = []

  // Заголовок
  lines.push('АКТ НОРМОКОНТРОЛЯ')
  lines.push(`Организация,${csvEscape(data.organization)}`)
  lines.push(`Документ,${csvEscape(data.document.name)}`)
  lines.push(`Обозначение,${csvEscape(data.document.designation || '—')}`)
  lines.push(`Формат,${data.document.format}`)
  lines.push(`Тип источника,${data.document.sourceType}`)
  lines.push(`Наименование,${csvEscape(data.stamp?.name || '—')}`)
  lines.push(`Масштаб,${csvEscape(data.stamp?.scale || '—')}`)
  lines.push(`Масса,${csvEscape(data.stamp?.mass || '—')}`)
  lines.push(`Материал,${csvEscape(data.stamp?.material || '—')}`)
  lines.push(`Литера,${csvEscape(data.stamp?.letter || '—')}`)
  lines.push(`Стадия,${csvEscape(data.stamp?.stage || '—')}`)
  lines.push(`Время проверки,${data.checkDuration ? (data.checkDuration / 1000).toFixed(1) + ' с' : '—'}`)
  lines.push('')
  lines.push('ЗАМЕЧАНИЯ')
  lines.push('№,Код правила,Критичность,Статус,Поле,Заголовок,Описание,Требование,Рекомендация,ГОСТ')

  const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...data.issues].sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3))

  sorted.forEach((issue, i) => {
    lines.push([
      i + 1,
      issue.code,
      sevLabel(issue.severity),
      statusLabel(issue.status),
      issue.field || '—',
      csvEscape(issue.title),
      csvEscape(issue.description),
      csvEscape(issue.gostRef || '—'),
      csvEscape(issue.recommendation || '—'),
      csvEscape(issue.gostRef || '—'),
    ].join(','))
  })

  lines.push('')
  lines.push(`Всего замечаний,${data.issues.length}`)
  lines.push(`Высокой критичности,${data.issues.filter(i => i.severity === 'high').length}`)
  lines.push(`Средней критичности,${data.issues.filter(i => i.severity === 'medium').length}`)
  lines.push(`Низкой критичности,${data.issues.filter(i => i.severity === 'low').length}`)
  lines.push('')
  lines.push(`Отчёт сформирован,${new Date().toLocaleString('ru-RU')}`)
  lines.push(`Система,НК-Контроль v0.2`)

  // BOM для корректного UTF-8 в Excel
  return '\ufeff' + lines.join('\n')
}

function csvEscape(s: string): string {
  if (!s) return ''
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function sevLabel(s: string): string {
  return s === 'high' ? 'Высокая' : s === 'medium' ? 'Средняя' : 'Низкая'
}

function statusLabel(s: string): string {
  return s === 'new' ? 'Новое' : s === 'confirmed' ? 'Подтверждено' : s === 'rejected' ? 'Отклонено' : 'Исправлено'
}
