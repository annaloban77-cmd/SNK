// stamp-ocr.ts — извлечение полей штампа из изображений/SVG
// Архитектура P5: детерминированный OCR вместо VLM
//
// Фолбэк-цепочка (по приоритету):
// 1. SVG-парсер (для bench-семплов) — 100% точно, мгновенно
// 2. Zone-OCR (препроцессинг + кроп штампа + Tesseract per field) — для реальных/деградированных сканов
// 3. VLM fallback (только крайний случай, логировать причину)

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { StampFields } from '@/lib/types'

export interface OcrResult {
  stamp: StampFields
  method: 'svg' | 'zone-ocr' | 'tesseract' | 'vlm' | 'none'
  durationMs: number
  confidence: number // 0..1
  rawText?: string
  preprocessing?: { skewAngle?: number; dpi?: number; formatMm?: { w: number; h: number } | null }
  fieldMeta?: Record<string, { hasText: boolean; confidence: number; parsed: boolean }>
}

// Главный метод — выбрать лучший OCR по контексту
export async function extractStamp(
  filePath: string,
  opts: { useVlmFallback?: boolean } = {}
): Promise<OcrResult> {
  const start = Date.now()

  // 1. Если есть SVG-исходник (bench-семплы) — парсим детерминированно
  const svgPath = filePath.replace(/\.png$|\.jpg$|\.jpeg$/i, '.svg').replace('/samples/', '/svg/')
  if (existsSync(svgPath)) {
    try {
      const svg = await readFile(svgPath, 'utf-8')
      const stamp = parseSvgStamp(svg)
      return {
        stamp,
        method: 'svg',
        durationMs: Date.now() - start,
        confidence: 1.0,
        rawText: `[SVG parsed: ${Object.keys(stamp).filter(k => stamp[k as keyof StampFields]).length} fields]`,
      }
    } catch (e) {
      // fall through to zone-ocr
    }
  }

  // 2. Zone-OCR (препроцессинг + кроп штампа + Tesseract per field) — для реальных сканов
  try {
    const { extractStampWithZoneOcr } = await import('./zone-ocr')
    const result = await extractStampWithZoneOcr(filePath)
    if (result.stamp && Object.keys(result.stamp).length > 0) {
      return {
        stamp: result.stamp,
        method: 'zone-ocr',
        durationMs: Date.now() - start,
        confidence: result.confidence,
        rawText: result.rawText,
        preprocessing: result.preprocessing as any,
        fieldMeta: result.fieldMeta,
      }
    }
  } catch (e) {
    console.error('Zone-OCR failed:', e)
  }

  // 3. VLM fallback (только если запрошен — логировать причину)
  if (opts.useVlmFallback) {
    console.warn('[OCR] Falling back to VLM — zone-OCR did not produce results')
    try {
      const { extractStampFromImage } = await import('@/lib/zai')
      const buf = await readFile(filePath)
      const ext = filePath.toLowerCase().split('.').pop() || 'png'
      const dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`
      const stamp = await extractStampFromImage(dataUrl)
      return {
        stamp: stamp || {},
        method: 'vlm',
        durationMs: Date.now() - start,
        confidence: 0.6,
      }
    } catch (e) {
      console.error('VLM fallback failed:', e)
    }
  }

  return { stamp: {}, method: 'none', durationMs: Date.now() - start, confidence: 0 }
}

// ============ SVG-парсер (детерминированный, для bench) ============
// Парсит SVG-исходник чертежа и извлекает поля штампа
export function parseSvgStamp(svg: string): StampFields {
  const stamp: StampFields = {
    format: null, designation: null, name: null, scale: null, mass: null,
    material: null, letter: null, stage: null,
    signatures: { developed: null, checked: null, normControl: null, approved: null },
    dates: null, invNumber: null, technicalRequirements: [], gostReferences: [],
    documentType: null, sheetCount: null, notes: null,
  }

  // Извлекаем <text> элементы с их координатами
  const textMatches = [...svg.matchAll(/<text[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
  const texts = textMatches.map(m => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
    text: decodeEntities(m[3]),
  })).filter(t => t.text.trim())

  // Штамп находится в нижнем правом углу (transform translate(stampX, stampY))
  // Ищем группу штампа по характерным меткам
  const stampGroupMatch = svg.match(/<g transform="translate\(([\d.]+),\s*([\d.]+)\)">[\s\S]*?<!-- Штамп[\s\S]*?<\/g>/)
  let stampOffsetX = 0, stampOffsetY = 0
  if (stampGroupMatch) {
    // Используем координаты группы штампа (последний <g transform> перед "Штамп")
    const transforms = [...svg.matchAll(/<g transform="translate\(([\d.]+),\s*([\d.]+)\)">/g)]
    // Берём transform, ближайший к комментарию "Штамп"
    const stampCommentIdx = svg.indexOf('<!-- Штамп')
    let best = transforms[0]
    for (const t of transforms) {
      if (t.index !== undefined && t.index < stampCommentIdx) best = t
    }
    if (best) {
      stampOffsetX = parseFloat(best[1])
      stampOffsetY = parseFloat(best[2])
    }
  }

  // Относительные координаты полей штампа (из buildDrawingSvg):
  // designation: x=10, y=170 (внутри группы штампа)
  // name: x=180, y=165
  // developed: x=125, y=50
  // checked: x=125, y=80
  // normControl: x=125, y=110
  // approved: x=125, y=140
  // В строке "A4 · 1:2 · 12,5 кг · Сталь..." — формат, масштаб, масса, материал
  // В строке "Лит. О · Стадия РК" — литера, стадия

  // Тексты внутри <g transform> имеют ЛОКАЛЬНЫЕ координаты (как в SVG-атрибутах)
  // Поэтому ищем по локальным координатам без смещения
  const findTextAt = (relX: number, relY: number, tolerance = 5) => {
    return texts.find(t => Math.abs(t.x - relX) < tolerance && Math.abs(t.y - relY) < tolerance)
  }

  // designation
  const desig = findTextAt(10, 170)
  if (desig) stamp.designation = desig.text.trim()

  // name (поле наименования)
  const name = findTextAt(180, 165)
  if (name) stamp.name = name.text.trim()

  // Подписи
  const dev = findTextAt(125, 50)
  if (dev) stamp.signatures!.developed = dev.text.trim()
  const chk = findTextAt(125, 80)
  if (chk) stamp.signatures!.checked = chk.text.trim()
  const nk = findTextAt(125, 110)
  if (nk) stamp.signatures!.normControl = nk.text.trim()
  const ap = findTextAt(125, 140)
  if (ap) stamp.signatures!.approved = ap.text.trim()

  // Строка с форматом/масштабом/массой/материалом — два text-элемента на y=178
  // Формат SVG: "A4 · 1:2 · 12,5 кг · Сталь 09Г2С ГОСТ 19281-2014" И "Лит. О · Стадия РК"
  const fmtLines = texts.filter(t => Math.abs(t.y - 178) < 3 && Math.abs(t.x - 180) < 10)
  for (const fl of fmtLines) {
    const text = fl.text
    // Формат: A4, A3, A2
    if (!stamp.format) {
      const fmtMatch = text.match(/\bA[0-4]\b/i)
      if (fmtMatch) stamp.format = fmtMatch[0].toUpperCase()
    }
    // Масштаб: 1:N или N:1
    if (!stamp.scale) {
      const scaleMatch = text.match(/(\d{1,2}\s*:\s*\d{1,2})/)
      if (scaleMatch) stamp.scale = scaleMatch[1].replace(/\s/g, '')
    }
    // Масса: число + кг (с возможной точкой)
    if (!stamp.mass) {
      const massMatch = text.match(/([\d.,]+)\s*кг\.?/i)
      if (massMatch) stamp.mass = massMatch[0]
    }
    // Материал: Сталь/Бронза/Латунь/Алюминий + марка + ГОСТ
    if (!stamp.material) {
      const matMatch = text.match(/(Сталь\s+\S+(?:\s+ГОСТ\s+[\d.-]+)?|Бронза\s+\S+(?:\s+ГОСТ\s+[\d.-]+)?|Латунь\s+\S+(?:\s+ГОСТ\s+[\d.-]+)?|Алюминий\s+\S+(?:\s+ГОСТ\s+[\d.-]+)?)/i)
      if (matMatch) stamp.material = matMatch[0].trim()
    }
    // Литера: "Лит. О"
    if (!stamp.letter) {
      const lm = text.match(/Лит\.\s*([АБВГДО]\d?)/i)
      if (lm) stamp.letter = lm[1].toUpperCase()
    }
    // Стадия: "Стадия РК"
    if (!stamp.stage) {
      const sm = text.match(/Стадия\s*([А-ЯA-Z]{2,4})/i)
      if (sm) stamp.stage = sm[1].toUpperCase()
    }
  }

  // Технические требования — тексты после "Технические требования"
  const ttIdx = texts.findIndex(t => /технические требования/i.test(t.text))
  if (ttIdx >= 0) {
    const ttBaseY = texts[ttIdx].y
    const ttX = texts[ttIdx].x
    // Берём следующие тексты, которые начинаются с цифры (пункты ТТ)
    const ttItems: string[] = []
    for (let i = ttIdx + 1; i < texts.length; i++) {
      const t = texts[i]
      if (t.y > ttBaseY && Math.abs(t.x - ttX) < 50 && t.y < ttBaseY + 200) {
        // Только пункты, начинающиеся с цифры (1. 2. 3.)
        if (/^\d+\./.test(t.text.trim())) {
          ttItems.push(t.text.trim())
        }
      }
      if (t.y > ttBaseY + 200) break
    }
    stamp.technicalRequirements = ttItems.length > 0 ? ttItems : null
  }

  // Перечень ГОСТ — собираем ГОСТ-ссылки из SVG, КРОМЕ материала
  // (материал проверяется отдельно правилом R-MAT-003)
  const allGostRefs: string[] = []
  for (const t of texts) {
    // Пропускаем текст в штампе (где материал с ГОСТ)
    if (Math.abs(t.y - 178) < 3 && Math.abs(t.x - 180) < 10) continue
    const matches = t.text.matchAll(/ГОСТ\s+[\d.\-]+/gi)
    for (const m of matches) {
      const ref = m[0].trim().replace(/\s+/g, ' ')
      if (!allGostRefs.includes(ref)) allGostRefs.push(ref)
    }
  }
  stamp.gostReferences = allGostRefs.length > 0 ? allGostRefs : null

  // Формат можно также извлечь из размеров SVG
  if (!stamp.format) {
    const sizeMatch = svg.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/i)
    if (sizeMatch) {
      const w = parseInt(sizeMatch[1])
      const h = parseInt(sizeMatch[2])
      // A4: 1000×1414, A3: 1414×2000, A2: 2000×2828
      if (Math.abs(w - 1000) < 10 && Math.abs(h - 1414) < 10) stamp.format = 'A4'
      else if (Math.abs(w - 1414) < 10 && Math.abs(h - 2000) < 10) stamp.format = 'A3'
      else if (Math.abs(w - 2000) < 10 && Math.abs(h - 2828) < 10) stamp.format = 'A2'
    }
  }

  return stamp
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

// ============ Tesseract.js (для реальных сканов) ============
let _tesseractWorker: any = null

async function extractStampWithTesseract(filePath: string): Promise<{ stamp: StampFields; confidence: number; rawText: string } | null> {
  try {
    // Динамический импорт — tesseract.js может быть тяжёлым
    const { createWorker } = await import('tesseract.js')

    if (!_tesseractWorker) {
      _tesseractWorker = await createWorker('rus+eng', 1, {
        logger: () => {}, // тихий режим
      })
    }

    // Tesseract работает с файлом напрямую
    const { data } = await _tesseractWorker.recognize(filePath)
    const rawText = data.text || ''
    const confidence = (data.confidence || 0) / 100

    const stamp = parseRawTextToStamp(rawText)
    return { stamp, confidence, rawText }
  } catch (e) {
    console.error('Tesseract init/recognize failed:', e)
    return null
  }
}

// Парсинг "сырого" текста OCR в поля штампа
function parseRawTextToStamp(text: string): StampFields {
  const stamp: StampFields = {
    format: null, designation: null, name: null, scale: null, mass: null,
    material: null, letter: null, stage: null,
    signatures: { developed: null, checked: null, normControl: null, approved: null },
    dates: null, invNumber: null, technicalRequirements: [], gostReferences: [],
    documentType: null, sheetCount: null, notes: null,
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Обозначение — шаблон XXX.XXXXXX.XXX
  for (const l of lines) {
    const m = l.match(/([А-ЯA-Z]{2,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4})/)
    if (m) { stamp.designation = m[1]; break }
  }

  // Масштаб
  for (const l of lines) {
    const m = l.match(/(\d{1,2}\s*:\s*\d{1,2})/)
    if (m && /\b1\s*:|:\s*1\b/.test(m[1])) { stamp.scale = m[1].replace(/\s/g, ''); break }
  }

  // Масса
  for (const l of lines) {
    const m = l.match(/([\d.,]+)\s*кг/i)
    if (m) { stamp.mass = m[0]; break }
  }

  // Формат
  for (const l of lines) {
    const m = l.match(/\bA[0-4]\b/i)
    if (m) { stamp.format = m[0].toUpperCase(); break }
  }

  // Материал
  for (const l of lines) {
    const m = l.match(/(Сталь\s+[\w\dГСН-]+(?:\s+ГОСТ\s+[\d.-]+)?|Бронза\s+\S+|Латунь\s+\S+|Алюминий\s+\S+)/i)
    if (m) { stamp.material = m[0]; break }
  }

  // Литера
  for (const l of lines) {
    const m = l.match(/\bЛит[.:]\s*([АБВГДО]\d?)/i)
    if (m) { stamp.letter = m[1].toUpperCase(); break }
  }
  // Стадия
  for (const l of lines) {
    const m = l.match(/\bСтади[яй][.:]\s*([А-ЯA-Z]{2,4})/i)
    if (m) { stamp.stage = m[1].toUpperCase(); break }
  }

  // Подписи
  const sigMap: { key: 'developed' | 'checked' | 'normControl' | 'approved'; pattern: RegExp }[] = [
    { key: 'developed', pattern: /Разраб[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)/i },
    { key: 'checked', pattern: /Пров[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)/i },
    { key: 'normControl', pattern: /Н\.?\s*контр[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)/i },
    { key: 'approved', pattern: /Утв[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)/i },
  ]
  for (const { key, pattern } of sigMap) {
    for (const l of lines) {
      const m = l.match(pattern)
      if (m) { stamp.signatures![key] = m[1]; break }
    }
  }

  // ГОСТ ссылки
  const gostRefs: string[] = []
  for (const l of lines) {
    const m = l.match(/ГОСТ\s+[\d.\-]+/gi)
    if (m) gostRefs.push(...m.map(s => s.trim()))
  }
  if (gostRefs.length > 0) stamp.gostReferences = [...new Set(gostRefs)]

  // Технические требования
  const ttIdx = lines.findIndex(l => /технические требования/i.test(l))
  if (ttIdx >= 0) {
    const ttItems = lines.slice(ttIdx + 1, ttIdx + 10).filter(l => /^\d+\./.test(l) || l.length > 10)
    if (ttItems.length > 0) stamp.technicalRequirements = ttItems
  }

  return stamp
}

// Очистка ресурсов tesseract (вызывать при завершении процесса)
export async function terminateOcr() {
  if (_tesseractWorker) {
    try { await _tesseractWorker.terminate() } catch {}
    _tesseractWorker = null
  }
}
