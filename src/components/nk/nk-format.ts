// Shared formatting helpers (Russian UI)

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

/** Format a date string (ISO) as "dd.MM.yyyy HH:mm" in ru locale */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return format(d, 'dd.MM.yyyy HH:mm', { locale: ru })
  } catch {
    return '—'
  }
}

/** Format a date string (ISO) as "dd.MM.yyyy" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return format(d, 'dd.MM.yyyy', { locale: ru })
  } catch {
    return '—'
  }
}

/** Bytes → human-readable: 248.3 КБ, 1.2 МБ */
export function formatBytes(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}

/** Milliseconds → human-readable: 8.5 с, 1.2 мин */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return '—'
  if (ms < 1000) return `${ms} мс`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} с`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min} мин ${sec} с`
}

/** Translate a backend category enum to a Russian label */
export const CATEGORY_LABELS: Record<string, string> = {
  stamp: 'Штамп',
  specification: 'Спецификация',
  material: 'Материал',
  cad_attr: 'CAD-атрибуты',
  format: 'Формат',
  geometry: 'Геометрия',
  semantic: 'Семантика',
}

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c
}

/**
 * Translate a backend method enum to a Russian, human-friendly label.
 * Технические значения (`deterministic`, `semantic`, `vision`) остаются в БД —
 * меняются только UI-подписи, чтобы не пугать нормоконтролёра жаргоном.
 */
export const METHOD_LABELS: Record<string, string> = {
  deterministic: 'Автопроверка по формату',
  semantic: 'Проверка смысла (ИИ)',
  vision: 'Проверка чертежа (ИИ)',
}

export function methodLabel(m: string): string {
  return METHOD_LABELS[m] ?? m
}

/**
 * Дополнительные подсказки для тултипов — объясняют технический смысл метода
 * там, где короткая подпись может быть неочевидна.
 */
export const METHOD_HINTS: Record<string, string> = {
  deterministic:
    'Жёсткие правила: формат листа, обозначение, масса, литера, подписи. Проверяются по формулам и регулярным выражениям без участия ИИ.',
  semantic:
    'ИИ-анализ смысла: согласованность полей, противоречия между заголовком и содержимым, корректность технических требований.',
  vision:
    'ИИ-распознавание чертежа: VLM-модель «видит» изображение штампа и извлекает из него поля основной надписи.',
}

export function methodHint(m: string): string | undefined {
  return METHOD_HINTS[m]
}

/** Translate a standard type to Russian */
export const STANDARD_TYPE_LABELS: Record<string, string> = {
  GOST: 'ГОСТ',
  OST: 'ОСТ',
  STO: 'СТО',
  RD: 'РД',
  REGISTER: 'Регистр',
  ESKD: 'ЕСКД',
  SPDS: 'СПДС',
}

export function standardTypeLabel(t: string): string {
  return STANDARD_TYPE_LABELS[t] ?? t
}

/** Translate a document sourceType to Russian */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  scan: 'Скан/IMG',
  pdf: 'PDF',
  dwg: 'DWG',
  dxf: 'DXF',
  cdw: 'CDW',
  sldprt: 'SLDPRT',
  sldasm: 'SLDASM',
  slddrw: 'SLDDRW',
  spw: 'SPW',
}

export function sourceTypeLabel(s: string): string {
  return SOURCE_TYPE_LABELS[s] ?? s
}

/** Translate a CheckLog stage to Russian */
export const STAGE_LABELS: Record<string, string> = {
  upload: 'Загрузка',
  vlm_extract: 'VLM-извлечение штампа',
  rules_check: 'Детерминированные правила',
  llm_semantic: 'LLM-семантика',
  report: 'Формирование отчёта',
}

export function stageLabel(s: string): string {
  return STAGE_LABELS[s] ?? s
}

/** Translate a CheckLog status to Russian */
export const STAGE_STATUS_LABELS: Record<string, string> = {
  started: 'Начато',
  success: 'Успешно',
  failed: 'Ошибка',
  skipped: 'Пропущено',
}

export function stageStatusLabel(s: string): string {
  return STAGE_STATUS_LABELS[s] ?? s
}

/** Translate an issue source to Russian */
export const ISSUE_SOURCE_LABELS: Record<string, string> = {
  auto: 'Авто',
  expert: 'Эксперт',
  llm: 'LLM',
}

export function issueSourceLabel(s: string): string {
  return ISSUE_SOURCE_LABELS[s] ?? s
}
