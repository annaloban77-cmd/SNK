import ZAI from 'z-ai-web-dev-sdk'

let _zai: ZAI | null = null

export async function getZAI(): Promise<ZAI> {
  if (_zai) return _zai
  _zai = await ZAI.create()
  return _zai
}

// Извлечение полей штампа из изображения/PDF чертежа через VLM
export interface ExtractedStamp {
  format?: string
  designation?: string
  name?: string
  scale?: string
  mass?: string
  material?: string
  letter?: string // литера
  stage?: string // стадия
  signatures?: {
    developed?: string
    checked?: string
    normControl?: string
    approved?: string
  }
  dates?: {
    developed?: string
    checked?: string
    approved?: string
  }
  invNumber?: string
  technicalRequirements?: string[]
  gostReferences?: string[]
  documentType?: string
  sheetCount?: number
  notes?: string
}

const STAMP_EXTRACTION_PROMPT = `Ты — эксперт нормоконтролер по ЕСКД/СПДС для судостроения.
Перед тобой скан/изображение конструкторского чертежа (формат A4/A3/A2/A1/A0).
Извлеки из основной надписи (штампа) и листа ВСЕ поля в виде JSON.

Требуется строго JSON (без markdown, без пояснений) следующей структуры:
{
  "format": "A3 | A4 | A2 | A1 | A0 | unknown",
  "designation": "обозначение документа (напр. АБВ.301254.001)",
  "name": "наименование изделия",
  "scale": "масштаб (напр. 1:2, 1:1, 2:1)",
  "mass": "масса с единицей измерения (напр. 12,5 кг)",
  "material": "материал с ГОСТ если указан",
  "letter": "литера (О, А, Б, ...)",
  "stage": "стадия (ЭП, ТП, РД, РК)",
  "signatures": {
    "developed": "Фамилия разработчика или пусто",
    "checked": "Фамилия проверившего или пусто",
    "normControl": "Фамилия нормоконтролера или пусто",
    "approved": "Фамилия утвердившего или пусто"
  },
  "dates": {
    "developed": "дата или пусто",
    "checked": "дата или пусто",
    "approved": "дата или пусто"
  },
  "invNumber": "инвентарный номер",
  "technicalRequirements": ["пункт 1 ТТ", "пункт 2 ТТ"],
  "gostReferences": ["ГОСТ 2.307", "ГОСТ 19281"],
  "documentType": "чертеж детали | сборочный чертеж | спецификация | схема | ведомость | ТУ | программа испытаний | прочее",
  "sheetCount": 1,
  "notes": "любые особенности оформления"
}

Если поле не распознаётся — оставь null или пустую строку. Если штамп отсутствует — явно укажи это в notes.`

export async function extractStampFromImage(
  imageDataUrl: string
): Promise<ExtractedStamp | null> {
  const zai = await getZAI()
  const response = await zai.chat.completions.createVision({
    model: 'glm-4.5v',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: STAMP_EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })
  const content = response?.choices?.[0]?.message?.content ?? ''
  return parseJsonLoose<ExtractedStamp>(content)
}

// Семантическая проверка через LLM — формирует замечания по извлечённым данным
export interface LlmIssueInput {
  code: string
  title: string
  description: string
  requirement?: string
  recommendation?: string
  gostRef?: string
  field?: string
  severity: 'high' | 'medium' | 'low'
}

const SEMANTIC_CHECK_PROMPT = `Ты — строгий нормоконтролер судостроительного предприятия.
Тебе переданы извлеченные из чертежа данные (JSON) и список применимых ГОСТ.
Найди несоответствия, которые НЕ ловятся детерминированными правилами:
- несогласованность терминов между штампом и ТТ
- отсутствие обязательных указаний (сварка, контроль, термическая обработка)
- противоречия между материалом и ГОСТ
- нестандартные формулировки, противоречащие ЕСКД
- отсутствие обязательных видов/разрезов (по смыслу)

Верни СТРОГО JSON-массив замечаний:
[
  {
    "code": "LLM-SEM-XXX",
    "title": "кратко",
    "description": "что не так",
    "requirement": "требование ГОСТ",
    "recommendation": "как исправить",
    "gostRef": "ГОСТ X, п.Y",
    "field": "проверяемое поле",
    "severity": "high|medium|low"
  }
]

Если замечаний нет — верни пустой массив []. Без markdown, без пояснений.`

export async function llmSemanticCheck(
  stamp: ExtractedStamp,
  applicableGost: string[]
): Promise<LlmIssueInput[]> {
  const zai = await getZAI()
  const userMessage = `Извлечённые данные чертежа:
${JSON.stringify(stamp, null, 2)}

Применимые ГОСТ/ОСТ/СТО:
${applicableGost.join('\n')}

Найди семантические несоответствия и верни JSON-массив замечаний.`

  const response = await zai.chat.completions.create({
    model: 'glm-4.6',
    messages: [
      { role: 'assistant', content: SEMANTIC_CHECK_PROMPT },
      { role: 'user', content: userMessage },
    ],
    thinking: { type: 'disabled' },
  })
  const content = response?.choices?.[0]?.message?.content ?? ''
  return parseJsonLoose<LlmIssueInput[]>(content) ?? []
}

// Универсальный парсер JSON с прощением markdown-обёрток
export function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null
  let s = raw.trim()
  // Удалить markdown-блоки ```json ... ``` или ``` ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // Найти первый { или [ и последний } или ]
  const firstBrace = s.search(/[{[]/)
  if (firstBrace > 0) s = s.slice(firstBrace)
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (lastBrace > -1) s = s.slice(0, lastBrace + 1)
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}
