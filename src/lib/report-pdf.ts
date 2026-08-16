// HTML report generator for normative control checks.
// Generates a print-friendly HTML document that the browser can render & print to PDF.
// Returns { html, filename } for the API route to ship as text/html attachment.
import { dbMon as db } from './db-monetization'
import { mapIssue, parseStamp } from '@/app/api/_map'
import type { StampFields, IssueDto, DocumentDto } from '@/lib/types'

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms} мс`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} с`
  const m = Math.floor(s / 60)
  const rest = Math.round(s - m * 60)
  return `${m} мин ${rest} с`
}

const SEVERITY_LABEL: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#2563eb',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Новое',
  confirmed: 'Подтверждено',
  rejected: 'Отклонено',
  fixed: 'Исправлено',
}

const STAGE_LABEL: Record<string, string> = {
  upload: 'Загрузка',
  vlm_extract: 'VLM-извлечение штампа',
  rules_check: 'Детерминированные правила',
  llm_semantic: 'LLM-семантика',
  report: 'Формирование отчёта',
}

interface ReportContext {
  document: DocumentDto
  issues: IssueDto[]
  checks: {
    id: string
    stage: string
    status: string
    durationMs: number | null
    message: string | null
    createdAt: Date | string
  }[]
  organizationName: string
}

export async function generateHtmlReport(documentId: string): Promise<{ html: string; filename: string } | null> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      project: { select: { id: true, code: true, name: true } },
      issues: {
        include: {
          rule: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      },
      checks: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!doc) return null

  // Resolve organization name (if document is linked)
  let organizationName = 'НК-Контроль'
  if (doc.organizationId) {
    const org = await db.organization.findUnique({ where: { id: doc.organizationId }, select: { name: true } })
    if (org?.name) organizationName = org.name
  } else {
    const anyOrg = await db.organization.findFirst({ select: { name: true } })
    if (anyOrg?.name) organizationName = anyOrg.name
  }

  // Build DocumentDto-like object for context
  const documentDto: DocumentDto = {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    format: doc.format,
    sourceType: doc.sourceType as DocumentDto['sourceType'],
    status: doc.status as DocumentDto['status'],
    stamp: parseStamp(doc.stampJson),
    ocrText: doc.ocrText,
    issueCount: doc.issueCount,
    highCount: doc.highCount,
    mediumCount: doc.mediumCount,
    lowCount: doc.lowCount,
    checkDuration: doc.checkDuration,
    docTypeId: doc.docTypeId,
    project: doc.project
      ? { id: doc.project.id, code: doc.project.code, name: doc.project.name }
      : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
  }

  const issues: IssueDto[] = doc.issues.map((i) =>
    mapIssue({
      ...i,
      document: { id: doc.id, name: doc.name, format: doc.format },
    })
  )

  const ctx: ReportContext = {
    document: documentDto,
    issues,
    checks: doc.checks.map((c) => ({
      id: c.id,
      stage: c.stage,
      status: c.status,
      durationMs: c.durationMs,
      message: c.message,
      createdAt: c.createdAt,
    })),
    organizationName,
  }

  const html = buildHtml(ctx)
  const safeName = (ctx.document.name || 'document').replace(/[^a-zA-ZА-Яа-я0-9._-]+/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `nk-report-${safeName}-${dateStr}.html`
  return { html, filename }
}

function buildHtml(ctx: ReportContext): string {
  const { document: doc, issues, checks, organizationName } = ctx
  const stamp: StampFields | null = doc.stamp
  const now = new Date()
  const nowStr = fmtDate(now.toISOString())

  const highCount = issues.filter((i) => i.severity === 'high').length
  const mediumCount = issues.filter((i) => i.severity === 'medium').length
  const lowCount = issues.filter((i) => i.severity === 'low').length
  const passed = highCount === 0
  const verdict = passed
    ? `<span class="verdict pass">✓ Документ проходит нормоконтроль</span>`
    : `<span class="verdict fail">✗ Документ НЕ проходит нормоконтроль</span>`

  // Stamp rows
  const stampRow = (label: string, value: string | null | undefined): string => `
    <tr>
      <td class="lbl">${escapeHtml(label)}</td>
      <td>${escapeHtml(value && String(value).trim() ? String(value) : '—')}</td>
    </tr>`

  const signaturesBlock = stamp?.signatures
    ? `
    <h3>Подписи</h3>
    <table class="stamp">
      ${stampRow('Разработал', stamp.signatures.developed)}
      ${stampRow('Проверил', stamp.signatures.checked)}
      ${stampRow('Н. контроль', stamp.signatures.normControl)}
      ${stampRow('Утвердил', stamp.signatures.approved)}
    </table>`
    : ''

  const datesBlock = stamp?.dates
    ? `
    <h3>Даты</h3>
    <table class="stamp">
      ${stampRow('Дата разработки', stamp.dates.developed)}
      ${stampRow('Дата проверки', stamp.dates.checked)}
      ${stampRow('Дата утверждения', stamp.dates.approved)}
    </table>`
    : ''

  const ttBlock =
    stamp?.technicalRequirements && stamp.technicalRequirements.length > 0
      ? `
    <h3>Технические требования</h3>
    <ol class="tt">
      ${stamp.technicalRequirements.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
    </ol>`
      : ''

  const gostBlock =
    stamp?.gostReferences && stamp.gostReferences.length > 0
      ? `
    <h3>Перечень ссылочных ГОСТ</h3>
    <ul class="gost">
      ${stamp.gostReferences.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}
    </ul>`
      : ''

  const issuesRows = issues.length
    ? issues
        .map(
          (i) => `
      <tr>
        <td><span class="sev sev-${i.severity}">${SEVERITY_LABEL[i.severity] ?? i.severity}</span></td>
        <td><strong>${escapeHtml(i.code)}</strong></td>
        <td>${escapeHtml(i.title)}</td>
        <td>${escapeHtml(i.field ?? '—')}</td>
        <td>${escapeHtml(i.gostRef ?? '—')}</td>
        <td>${escapeHtml(STATUS_LABEL[i.status] ?? i.status)}</td>
        <td>${escapeHtml(i.recommendation ?? '—')}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="7" class="empty">Замечаний не обнаружено</td></tr>`

  const timelineRows = checks.length
    ? checks
        .map(
          (c) => `
      <tr>
        <td>${escapeHtml(STAGE_LABEL[c.stage] ?? c.stage)}</td>
        <td><span class="stage stage-${c.status}">${c.status === 'success' ? '✓ Успех' : c.status === 'failed' ? '✗ Ошибка' : '⟳ Начат'}</span></td>
        <td>${escapeHtml(fmtDuration(c.durationMs))}</td>
        <td>${escapeHtml(c.message ?? '—')}</td>
        <td>${escapeHtml(fmtDate(c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt))}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">Журнал проверок пуст</td></tr>`

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Отчёт нормоконтроля — ${escapeHtml(doc.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "PT Sans", "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    font-size: 11pt;
    line-height: 1.45;
    margin: 0;
    padding: 0;
  }
  h1 { font-size: 20pt; margin: 0 0 4pt 0; color: #0f172a; }
  h2 { font-size: 14pt; margin: 22pt 0 8pt 0; padding-bottom: 4pt; border-bottom: 2px solid #cbd5e1; color: #0f172a; }
  h3 { font-size: 12pt; margin: 14pt 0 6pt 0; color: #334155; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; margin-bottom: 16pt; }
  .header .org { font-size: 10pt; color: #475569; text-align: right; }
  .header .org strong { display: block; font-size: 11pt; color: #1e293b; margin-bottom: 2pt; }
  .meta { color: #64748b; font-size: 10pt; margin: 4pt 0 0 0; }
  .summary { display: flex; flex-wrap: wrap; gap: 8pt; margin: 12pt 0; }
  .summary .card {
    flex: 1 1 110pt;
    border: 1px solid #e2e8f0;
    border-radius: 6pt;
    padding: 8pt 10pt;
    background: #f8fafc;
  }
  .summary .card .lbl { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
  .summary .card .val { font-size: 16pt; font-weight: 700; color: #0f172a; margin-top: 2pt; }
  .summary .card.high .val { color: #dc2626; }
  .summary .card.medium .val { color: #d97706; }
  .summary .card.low .val { color: #2563eb; }
  .verdict {
    display: inline-block;
    padding: 6pt 12pt;
    border-radius: 6pt;
    font-weight: 700;
    font-size: 12pt;
    margin: 8pt 0 4pt 0;
  }
  .verdict.pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .verdict.fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt 0; }
  table th, table td { padding: 6pt 8pt; text-align: left; vertical-align: top; border-bottom: 1px solid #e2e8f0; font-size: 10pt; }
  table th { background: #f1f5f9; color: #334155; font-weight: 600; }
  table.stamp td.lbl { width: 38%; color: #64748b; background: #f8fafc; }
  table.issues th { background: #0f172a; color: #f8fafc; }
  .sev { display: inline-block; padding: 2pt 6pt; border-radius: 3pt; font-size: 9pt; font-weight: 600; color: #fff; }
  .sev-high { background: #dc2626; }
  .sev-medium { background: #d97706; }
  .sev-low { background: #2563eb; }
  .stage { display: inline-block; padding: 1pt 6pt; border-radius: 3pt; font-size: 9pt; font-weight: 600; }
  .stage-success { background: #dcfce7; color: #166534; }
  .stage-failed { background: #fee2e2; color: #991b1b; }
  .stage-started { background: #fef3c7; color: #92400e; }
  .empty { text-align: center; color: #94a3b8; padding: 12pt; font-style: italic; }
  ul.gost, ol.tt { margin: 4pt 0 8pt 18pt; padding: 0; }
  ul.gost li, ol.tt li { margin-bottom: 3pt; font-size: 10pt; }
  .footer {
    margin-top: 24pt;
    padding-top: 8pt;
    border-top: 1px solid #cbd5e1;
    font-size: 9pt;
    color: #64748b;
    text-align: center;
  }
  .page-break { page-break-before: always; }
  @media print {
    .no-print { display: none !important; }
  }
  .print-bar {
    position: sticky; top: 0; right: 0;
    display: flex; justify-content: flex-end; gap: 8pt;
    padding: 8pt 12pt; background: #fff; border-bottom: 1px solid #e2e8f0;
  }
  .print-bar button {
    background: #0f172a; color: #fff; border: 0; padding: 6pt 14pt;
    border-radius: 4pt; font-size: 10pt; cursor: pointer; font-weight: 600;
  }
  .print-bar button:hover { background: #1e293b; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button onclick="window.print()">🖨 Печать / Сохранить в PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>Отчёт нормоконтроля</h1>
      <div class="meta">Документ: <strong>${escapeHtml(doc.name)}</strong></div>
      <div class="meta">Сформирован: ${nowStr}</div>
    </div>
    <div class="org">
      <strong>${escapeHtml(organizationName)}</strong>
      <div>НК-Контроль · Система нормативного контроля</div>
    </div>
  </div>

  <h2>Сведения о документе</h2>
  <table class="stamp">
    <tr><td class="lbl">Наименование файла</td><td>${escapeHtml(doc.originalName || doc.name)}</td></tr>
    <tr><td class="lbl">Формат</td><td>${escapeHtml(doc.format || '—')}</td></tr>
    <tr><td class="lbl">Тип источника</td><td>${escapeHtml(doc.sourceType)}</td></tr>
    <tr><td class="lbl">MIME-тип</td><td>${escapeHtml(doc.mimeType)}</td></tr>
    <tr><td class="lbl">Размер</td><td>${doc.size} байт</td></tr>
    <tr><td class="lbl">Проект</td><td>${escapeHtml(doc.project ? `${doc.project.code} — ${doc.project.name}` : '—')}</td></tr>
    <tr><td class="lbl">Дата загрузки</td><td>${fmtDate(doc.createdAt)}</td></tr>
    <tr><td class="lbl">Дата проверки</td><td>${fmtDate(doc.updatedAt)}</td></tr>
  </table>

  ${stamp ? `
  <h2>Извлечённые данные основной надписи (ГОСТ 2.104)</h2>
  <table class="stamp">
    ${stampRow('Обозначение', stamp.designation)}
    ${stampRow('Наименование', stamp.name)}
    ${stampRow('Масштаб', stamp.scale)}
    ${stampRow('Масса', stamp.mass)}
    ${stampRow('Материал', stamp.material)}
    ${stampRow('Литера', stamp.letter)}
    ${stampRow('Стадия', stamp.stage)}
    ${stampRow('Инв. номер', stamp.invNumber)}
    ${stampRow('Листов', stamp.sheetCount != null ? String(stamp.sheetCount) : null)}
    ${stampRow('Тип документа', stamp.documentType)}
    ${stampRow('Примечания', stamp.notes)}
  </table>
  ${signaturesBlock}
  ${datesBlock}
  ${ttBlock}
  ${gostBlock}
  ` : '<p class="empty">Штамп не извлечён — VLM-анализ не выполнялся или завершился ошибкой.</p>'}

  <h2>Сводка по проверке</h2>
  ${verdict}
  <div class="summary">
    <div class="card"><div class="lbl">Всего замечаний</div><div class="val">${issues.length}</div></div>
    <div class="card high"><div class="lbl">Высокая</div><div class="val">${highCount}</div></div>
    <div class="card medium"><div class="lbl">Средняя</div><div class="val">${mediumCount}</div></div>
    <div class="card low"><div class="lbl">Низкая</div><div class="val">${lowCount}</div></div>
    <div class="card"><div class="lbl">Длительность</div><div class="val" style="font-size:13pt">${escapeHtml(fmtDuration(doc.checkDuration))}</div></div>
  </div>

  <h2>Замечания</h2>
  <table class="issues">
    <thead>
      <tr>
        <th style="width:9%">Критич.</th>
        <th style="width:12%">Код</th>
        <th>Заголовок</th>
        <th style="width:12%">Поле</th>
        <th style="width:14%">ГОСТ</th>
        <th style="width:11%">Статус</th>
        <th>Рекомендация</th>
      </tr>
    </thead>
    <tbody>
      ${issuesRows}
    </tbody>
  </table>

  <div class="page-break"></div>
  <h2>Журнал проверок</h2>
  <table>
    <thead>
      <tr>
        <th>Этап</th>
        <th style="width:12%">Статус</th>
        <th style="width:12%">Длит.</th>
        <th>Сообщение</th>
        <th style="width:18%">Дата</th>
      </tr>
    </thead>
    <tbody>
      ${timelineRows}
    </tbody>
  </table>

  <div class="footer">
    Сформировано системой «НК-Контроль» · ${nowStr} · ${escapeHtml(organizationName)}<br>
    Отчёт сформирован автоматически на основе детерминированных правил и LLM-семантического анализа.
  </div>
</body>
</html>`
}
