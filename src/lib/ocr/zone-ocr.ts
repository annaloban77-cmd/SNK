// zone-ocr.ts — zone-based OCR штампа (оптимизированный)
// 2 Tesseract-вызова на семпл: full stamp (PSM 6) + format line (PSM 7)
// Плюс 1 вызов для ТТ = 3 total. ~3-6 сек на семпл.

import sharp from 'sharp'
import type { StampFields } from '@/lib/types'

let _worker: any = null

async function getWorker() {
  if (!_worker) {
    const { createWorker } = await import('tesseract.js')
    _worker = await createWorker('rus+eng', 1, { logger: () => {} })
  }
  return _worker
}

export async function terminateZoneOcr() {
  if (_worker) {
    try { await _worker.terminate() } catch {}
    _worker = null
  }
}

export interface ZoneOcrResult {
  stamp: StampFields
  method: 'zone-ocr' | 'none'
  durationMs: number
  confidence: number
  rawText: string
  preprocessing?: { skewAngle?: number; dpi?: number }
  // Per-field metadata: для каждого поля — был ли текст в зоне, confidence, распарсен ли
  fieldMeta?: Record<string, { hasText: boolean; confidence: number; parsed: boolean }>
}

// Главный метод — zone-OCR штампа (оптимизированный: 2-3 вызова Tesseract)
export async function extractStampWithZoneOcr(filePath: string): Promise<ZoneOcrResult> {
  const start = Date.now()

  try {
    const img = sharp(filePath)
    const meta = await img.metadata()
    const w = meta.width || 1000
    const h = meta.height || 1414

    // 1. Бинаризация (Otsu) для лучшего OCR
    const grayBuf = await img.grayscale().raw().toBuffer({ resolveWithObject: true })
    const threshold = otsuThreshold(grayBuf.data)
    const binaryBuf = Buffer.alloc(grayBuf.data.length)
    for (let i = 0; i < grayBuf.data.length; i++) {
      binaryBuf[i] = grayBuf.data[i] < threshold ? 0 : 255
    }
    const binaryPng = await sharp(binaryBuf, {
      raw: { width: grayBuf.info.width, height: grayBuf.info.height, channels: 1 },
    }).png().toBuffer()

    // 2. Frame detection — находим рамку для точного позиционирования штампа
    const frame = detectFrame(grayBuf.data, grayBuf.info.width, grayBuf.info.height)

    // 2a. Кроп штампа (нижний-правый угол, с учётом frame)
    // Если frame найден — штамп в правом нижнем углу frame
    // Если нет — используем относительные позиции
    let stampX: number, stampY: number, stampW: number, stampH: number
    if (frame) {
      // Штамп: 185×55мм, frame ~A4 (210×297мм)
      // stampW = 185/210 * frameW ≈ 0.88 * frameW — но это слишком широко
      // На самом деле в наших SVG штамп ~340px при frame ~960px → 0.354
      stampW = Math.round(frame.w * 0.36)
      stampH = Math.round(frame.h * 0.13)
      stampX = frame.x + frame.w - stampW - Math.round(frame.w * 0.02)
      stampY = frame.y + frame.h - stampH - Math.round(frame.h * 0.01)
    } else {
      stampX = Math.round(w * 0.60)
      stampY = Math.round(h * 0.82)
      stampW = Math.min(Math.round(w * 0.38), w - stampX - 1)
      stampH = Math.min(Math.round(h * 0.16), h - stampY - 1)
    }

    // 2b. Ink detection — проверяем наличие тёмных пикселей в зонах полей
    const inkMeta = await detectInkInZones(binaryPng, grayBuf.info.width, grayBuf.info.height, stampX, stampY, stampW, stampH)

    const stampImg = await sharp(binaryPng)
      .extract({ left: stampX, top: stampY, width: stampW, height: stampH })
      .resize(stampW * 4, stampH * 4, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer()

    const worker = await getWorker()
    const stamp: StampFields = {
      format: null, designation: null, name: null, scale: null, mass: null,
      material: null, letter: null, stage: null,
      signatures: { developed: null, checked: null, normControl: null, approved: null },
      dates: null, invNumber: null, technicalRequirements: [], gostReferences: [],
      documentType: null, sheetCount: null, notes: null,
    }

    // 3. Вызов 1: весь штамп (PSM 6 = uniform block)
    const { data: fullData } = await worker.recognize(stampImg, {}, {
      tessedit_pageseg_mode: '6',
    })
    const fullText = fullData.text || ''
    const fullConf = (fullData.confidence || 0) / 100
    const fullLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

    // 4. Вызов 2: формат-строка (нижняя часть штампа, PSM 7 = single line)
    const stampMeta = await sharp(stampImg).metadata()
    const stampW2 = stampMeta.width || stampW * 4
    const stampH2 = stampMeta.height || stampH * 4
    const fmtZone = {
      left: Math.round(stampW2 * 0.50),
      top: Math.round(stampH2 * 0.85),
      width: Math.min(Math.round(stampW2 * 0.48), stampW2 - Math.round(stampW2 * 0.50) - 1),
      height: Math.min(Math.round(stampH2 * 0.15), stampH2 - Math.round(stampH2 * 0.85) - 1),
    }
    let fmtText = ''
    let fmtConf = 0
    try {
      const fmtImg = await sharp(stampImg).extract(fmtZone).png().toBuffer()
      const { data: fmtData } = await worker.recognize(fmtImg, {}, {
        tessedit_pageseg_mode: '7',
      })
      fmtText = fmtData.text || ''
      fmtConf = (fmtData.confidence || 0) / 100
    } catch {}

    // 5. Парсинг полей из fullText + fmtText
    const fieldMeta = parseStampFromZoneText(stamp, fullLines, fmtText, w, h)
    // 5a. Объединяем с ink detection (приоритетнее для hasText)
    mergeInkIntoMeta(fieldMeta, inkMeta)

    // 6. Вызов 3 (опционально): ТТ
    try {
      const ttX = Math.round(w * 0.05)
      const ttY = Math.round(h * 0.50)
      const ttW = Math.min(Math.round(w * 0.45), w - ttX - 1)
      const ttH = Math.min(Math.round(h * 0.20), h - ttY - 1)
      const ttImg = await sharp(binaryPng)
        .extract({ left: ttX, top: ttY, width: ttW, height: ttH })
        .resize(ttW * 2, ttH * 2, { fit: 'fill', kernel: 'lanczos3' })
        .png()
        .toBuffer()
      const { data: ttData } = await worker.recognize(ttImg, {}, {
        tessedit_pageseg_mode: '6',
      })
      const ttLines = (ttData.text || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+[.:]/.test(l))
      if (ttLines.length > 0) stamp.technicalRequirements = ttLines
    } catch {}

    const avgConf = (fullConf + fmtConf) / 2

    return {
      stamp,
      method: 'zone-ocr',
      durationMs: Date.now() - start,
      confidence: avgConf,
      rawText: `[full:${Math.round(fullConf*100)}%] ${fullText}\n[fmt:${Math.round(fmtConf*100)}%] ${fmtText}`,
      preprocessing: { dpi: Math.round(w / 297 * 25.4) },
      fieldMeta,
    }
  } catch (e) {
    console.error('Zone-OCR failed:', e)
    return {
      stamp: {},
      method: 'none',
      durationMs: Date.now() - start,
      confidence: 0,
      rawText: '',
    }
  }
}

// Парсинг полей из текста штампа
function parseStampFromZoneText(
  stamp: StampFields,
  lines: string[],
  fmtText: string,
  imgW: number,
  imgH: number
): Record<string, { hasText: boolean; confidence: number; parsed: boolean }> {
  const meta: Record<string, { hasText: boolean; confidence: number; parsed: boolean }> = {}
  // Обозначение — XXX.XXXXXX.XX
  for (const l of lines) {
    const m = l.match(/([А-ЯA-Z]{2,6}[.\s][А-ЯA-Z0-9]{4,8}[.\s][А-ЯA-Z0-9]{2,4})/)
    if (m) { stamp.designation = m[1].replace(/\s/g, '.'); break }
    const m2 = l.match(/([А-ЯA-Z0-9]{2,}\.[А-ЯA-Z0-9]{4,}\.[А-ЯA-Z0-9]{2,})/)
    if (m2) { stamp.designation = m2[1]; break }
  }

  // Подписи — ищем Фамилия И.О.
  const sigPatterns: { key: 'developed' | 'checked' | 'normControl' | 'approved'; re: RegExp }[] = [
    { key: 'developed', re: /Разраб[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.?)/i },
    { key: 'checked', re: /Пров[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.?)/i },
    { key: 'normControl', re: /Н\.?\s*контр[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.?)/i },
    { key: 'approved', re: /Утв[.:]?\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.?)/i },
  ]
  for (const { key, re } of sigPatterns) {
    for (const l of lines) {
      const m = l.match(re)
      if (m && m[1]) { stamp.signatures![key] = m[1]; break }
    }
    // Толерантный: если не нашли по метке, ищем любые Фамилия И.О. в соответствующей строке
    if (!stamp.signatures![key]) {
      const idx = sigPatterns.indexOf({ key, re })
      if (idx >= 0 && idx < lines.length) {
        const line = lines[idx]
        const m = line.match(/([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.?)/)
        if (m) stamp.signatures![key] = m[1]
      }
    }
  }

  // Формат-строка: Формат · Масштаб · Масса · Материал · Литера · Стадия
  const fmtCombined = fmtText + ' ' + lines.join(' ')

  // Формат
  const fm = fmtCombined.match(/\b([AАaа][0-4])\b/)
  if (fm) stamp.format = fm[1].toUpperCase().replace('А', 'A')
  else {
    // Из размера изображения
    if (imgW < 1200) stamp.format = 'A4'
    else if (imgW < 1800) stamp.format = 'A3'
    else stamp.format = 'A2'
  }

  // Масштаб
  const sm = fmtCombined.match(/(\d{1,2})\s*[:：]\s*(\d{1,3})/)
  if (sm) stamp.scale = `${sm[1]}:${sm[2]}`

  // Масса
  const mm = fmtCombined.match(/([\d.,]+)\s*(кг|kg|к|r|k)\b/i)
  if (mm) stamp.mass = `${mm[1]} кг`

  // Материал
  const mat = fmtCombined.match(/(Сталь\s+\S+(?:\s+ГОСТ\s+[\d.\-]+)?|Бронза\s+\S+(?:\s+ГОСТ\s+[\d.\-]+)?|Латунь\s+\S+(?:\s+ГОСТ\s+[\d.\-]+)?|Алюминий\s+\S+(?:\s+ГОСТ\s+[\d.\-]+)?)/i)
  if (mat) stamp.material = mat[0].trim()
  else {
    const mat2 = fmtCombined.match(/(Сталь\s+\S+|Бронза\s+\S+|Латунь\s+\S+|Алюминий\s+\S+)/i)
    if (mat2) stamp.material = mat2[0].trim()
  }

  // Литера
  const lm = fmtCombined.match(/Лит[.:]?\s*([АБВГDOО]\d?)/i)
  if (lm) stamp.letter = lm[1].toUpperCase()

  // Стадия
  const stm = fmtCombined.match(/Стади[яй][.:]?\s*([А-ЯA-Z]{2,4})/i)
  if (stm) stamp.stage = stm[1].toUpperCase()
  else {
    const stm2 = fmtCombined.match(/\b(РК|РД|РП|ЭП|ТП)\b/)
    if (stm2) stamp.stage = stm2[1]
  }

  // Наименование — строка в центре штампа (не подпись, не обозначение)
  for (const l of lines) {
    if (l === stamp.designation) continue
    if (/Разраб|Пров|Н\.?\s*контр|Утв|Изм|Лист|№ докум|Подп|Дата/.test(l)) continue
    if (/[А-ЯЁ][а-яё]+/.test(l) && !/ГОСТ|Сталь|Бронза|Латунь|Алюминий/.test(l)) {
      const cleaned = l.replace(/[^А-Яа-яЁё\w\s\-()]/g, '').trim()
      if (cleaned.length > 2 && cleaned.length < 50) {
        stamp.name = cleaned
        break
      }
    }
  }

  // ГОСТ ссылки
  const gostRefs: string[] = []
  const matches = [...fmtCombined.matchAll(/ГОСТ\s+[\d.\-]+/gi)]
  for (const m of matches) {
    const ref = m[0].trim().replace(/\s+/g, ' ')
    if (!gostRefs.includes(ref)) gostRefs.push(ref)
  }
  if (gostRefs.length > 0) stamp.gostReferences = gostRefs

  // Заполняем per-field метаданные
  // Ключевая логика: если в OCR-тексте есть упоминание поля (метка или значение),
  // но парсинг не удался — поле существует (hasText=true), просто не распознано
  const allText = fmtCombined.toLowerCase()

  meta.designation = {
    hasText: lines.some(l => /[А-ЯA-Z]{2,}[.\s]\d/.test(l)) || !!stamp.designation,
    confidence: stamp.designation ? 0.8 : 0.4,
    parsed: !!stamp.designation,
  }
  meta.name = {
    hasText: lines.some(l => /[А-ЯЁ][а-яё]+/.test(l) && !/Разраб|Пров|Утв|Изм|Лист|Подп|Дата|ГОСТ/.test(l)),
    confidence: stamp.name ? 0.7 : 0.4,
    parsed: !!stamp.name,
  }
  meta.scale = {
    hasText: /\d+\s*[:：]\s*\d+/.test(allText) || /\bмасштаб/i.test(allText),
    confidence: stamp.scale ? 0.8 : 0.4,
    parsed: !!stamp.scale,
  }
  meta.mass = {
    hasText: /\bкг\b|\bkg\b|масс/i.test(allText) || /\d+[,.\d]*\s*(к|r|k)/i.test(allText),
    confidence: stamp.mass ? 0.8 : 0.4,
    parsed: !!stamp.mass,
  }
  meta.material = {
    hasText: /сталь|бронза|латунь|алюмин|матер/i.test(allText),
    confidence: stamp.material ? 0.8 : 0.4,
    parsed: !!stamp.material,
  }
  meta.letter = {
    hasText: /лит/i.test(allText),
    confidence: stamp.letter ? 0.8 : 0.4,
    parsed: !!stamp.letter,
  }
  meta.stage = {
    hasText: /стади/i.test(allText) || /\b(РК|РД|РП|ЭП|ТП)\b/i.test(allText),
    confidence: stamp.stage ? 0.8 : 0.4,
    parsed: !!stamp.stage,
  }
  // Подписи: проверяем по меткам в тексте
  meta.developed = {
    hasText: /разраб/i.test(allText) || lines.some(l => /[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\./.test(l)),
    confidence: stamp.signatures?.developed ? 0.7 : 0.4,
    parsed: !!stamp.signatures?.developed,
  }
  meta.checked = {
    hasText: /пров/i.test(allText),
    confidence: stamp.signatures?.checked ? 0.7 : 0.4,
    parsed: !!stamp.signatures?.checked,
  }
  meta.normControl = {
    hasText: /н\.?\s*контр/i.test(allText),
    confidence: stamp.signatures?.normControl ? 0.7 : 0.4,
    parsed: !!stamp.signatures?.normControl,
  }
  meta.approved = {
    hasText: /утв/i.test(allText),
    confidence: stamp.signatures?.approved ? 0.7 : 0.4,
    parsed: !!stamp.signatures?.approved,
  }
  meta.format = {
    hasText: true, // формат всегда определяем по размеру изображения
    confidence: 0.9,
    parsed: !!stamp.format,
  }
  meta.gostReferences = {
    hasText: /гост/i.test(allText),
    confidence: stamp.gostReferences && stamp.gostReferences.length > 0 ? 0.8 : 0.4,
    parsed: !!(stamp.gostReferences && stamp.gostReferences.length > 0),
  }
  meta.technicalRequirements = {
    hasText: /технические требования|неуказан/i.test(allText),
    confidence: 0.6,
    parsed: !!(stamp.technicalRequirements && stamp.technicalRequirements.length > 0),
  }

  return meta
}

// Frame detection — находим внешнюю рамку чертежа
// Сканируем профили строк/столбцов для определения границ рамки
function detectFrame(data: Buffer, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  const threshold = 128
  // Считаем профиль строк (сколько тёмных пикселей в каждой строке)
  const rowProfile = new Float64Array(h)
  const colProfile = new Float64Array(w)
  for (let y = 0; y < h; y += 2) {
    let dark = 0
    for (let x = 0; x < w; x += 4) {
      if (data[y * w + x] < threshold) dark++
    }
    rowProfile[y] = dark
  }
  for (let x = 0; x < w; x += 2) {
    let dark = 0
    for (let y = 0; y < h; y += 4) {
      if (data[y * w + x] < threshold) dark++
    }
    colProfile[x] = dark
  }

  // Рамка — это строки/столбцы с высоким количеством тёмных пикселей
  // Найти первую и последнюю строку с > 30% тёмных пикселей
  const rowThreshold = w / 4 * 0.3
  const colThreshold = h / 4 * 0.3

  let top = -1, bottom = -1, left = -1, right = -1
  for (let y = 0; y < h; y++) {
    if (rowProfile[y] > rowThreshold) {
      if (top < 0) top = y
      bottom = y
    }
  }
  for (let x = 0; x < w; x++) {
    if (colProfile[x] > colThreshold) {
      if (left < 0) left = x
      right = x
    }
  }

  if (top < 0 || left < 0 || bottom <= top || right <= left) return null
  return { x: left, y: top, w: right - left, h: bottom - top }
}

// Ink detection — проверка наличия тёмных пикселей в зонах полей
// Использует общую ink ratio в области штампа + индивидуальные зоны
// Если штамп имеет достаточно ink (текст/линии), поля считаются присутствующими
async function detectInkInZones(
  binaryPng: Buffer,
  imgW: number,
  imgH: number,
  stampX: number,
  stampY: number,
  stampW: number,
  stampH: number
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}

  // Загружаем бинарное изображение
  const rawData = await sharp(binaryPng).raw().toBuffer({ resolveWithObject: true })
  const data = rawData.data
  const w = rawData.info.width

  // Шумофильр: считаем пиксель тёмным только если ≥2 из 4 соседей тоже тёмные
  // Это убирает изолированный шум от деградации
  const denoisedData = Buffer.alloc(data.length)
  for (let y = 1; y < rawData.info.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      if (data[idx] < 128) {
        let neighbors = 0
        if (data[idx - 1] < 128) neighbors++
        if (data[idx + 1] < 128) neighbors++
        if (data[idx - w] < 128) neighbors++
        if (data[idx + w] < 128) neighbors++
        denoisedData[idx] = neighbors >= 2 ? 0 : 255
      } else {
        denoisedData[idx] = 255
      }
    }
  }

  // Сначала проверяем общую ink ratio в штампе
  // Расширяем область для надёжности (±10% по каждой стороне)
  const margin = 0.1
  const sx0 = Math.max(0, Math.round(stampX - stampW * margin))
  const sy0 = Math.max(0, Math.round(stampY - stampH * margin))
  const sx1 = Math.min(imgW, Math.round(stampX + stampW * (1 + margin)))
  const sy1 = Math.min(imgH, Math.round(stampY + stampH * (1 + margin)))

  let stampDark = 0, stampTotal = 0
  for (let y = sy0; y < sy1; y += 2) {
    for (let x = sx0; x < sx1; x += 2) {
      const idx = y * w + x
      if (idx < data.length) {
        if (denoisedData[idx] < 128) stampDark++
        stampTotal++
      }
    }
  }
  const stampInkRatio = stampTotal > 0 ? stampDark / stampTotal : 0

  // Если в штампе > 3% тёмных пикселей — штамп заполнен
  // Все поля считаем "имеющими текст" (hasText=true)
  const stampHasContent = stampInkRatio > 0.03

  // Индивидуальные зоны (более точные, но с расширенными границами)
  const zones: Record<string, { x: number; y: number; w: number; h: number }> = {
    developed:   { x: stampX + stampW * 0.35, y: stampY + stampH * 0.12, w: stampW * 0.50, h: stampH * 0.16 },
    checked:     { x: stampX + stampW * 0.35, y: stampY + stampH * 0.28, w: stampW * 0.50, h: stampH * 0.16 },
    normControl: { x: stampX + stampW * 0.35, y: stampY + stampH * 0.44, w: stampW * 0.50, h: stampH * 0.16 },
    approved:    { x: stampX + stampW * 0.35, y: stampY + stampH * 0.60, w: stampW * 0.50, h: stampH * 0.16 },
    designation: { x: stampX + stampW * 0.03, y: stampY + stampH * 0.82, w: stampW * 0.50, h: stampH * 0.16 },
    name:        { x: stampX + stampW * 0.50, y: stampY + stampH * 0.80, w: stampW * 0.48, h: stampH * 0.10 },
    formatLine:  { x: stampX + stampW * 0.50, y: stampY + stampH * 0.90, w: stampW * 0.48, h: stampH * 0.08 },
  }

  for (const [fieldName, zone] of Object.entries(zones)) {
    const x0 = Math.max(0, Math.round(zone.x))
    const y0 = Math.max(0, Math.round(zone.y))
    const x1 = Math.min(imgW, Math.round(zone.x + zone.w))
    const y1 = Math.min(imgH, Math.round(zone.y + zone.h))

    let darkPixels = 0
    let totalPixels = 0
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const idx = y * w + x
        if (idx < data.length) {
          if (denoisedData[idx] < 128) darkPixels++
          totalPixels++
        }
      }
    }

    const darkRatio = totalPixels > 0 ? darkPixels / totalPixels : 0
    // Если в конкретной зоне > 1.5% ink ИЛИ штамп в целом заполнен → поле присутствует
    result[fieldName] = darkRatio > 0.015 || stampHasContent
  }

  // Для остальных полей (масштаб, масса, литера, стадия, ГОСТ, ТТ) — используем общий показатель
  const otherFields = ['scale', 'mass', 'material', 'letter', 'stage', 'gostReferences', 'technicalRequirements']
  for (const f of otherFields) {
    result[f] = stampHasContent
  }

  return result
}

// Обновить fieldMeta с ink detection данными
function mergeInkIntoMeta(
  meta: Record<string, { hasText: boolean; confidence: number; parsed: boolean }>,
  inkMeta: Record<string, boolean>
) {
  for (const [key, hasInk] of Object.entries(inkMeta)) {
    if (meta[key]) {
      // Ink detection приоритетнее OCR-текста для hasText
      meta[key].hasText = hasInk || meta[key].hasText
    }
  }
}

// Otsu threshold
function otsuThreshold(data: Buffer): number {
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i++) histogram[data[i]]++
  const total = data.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]
  let sumB = 0, wB = 0, maxVariance = 0, threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) ** 2
    if (variance > maxVariance) { maxVariance = variance; threshold = t }
  }
  return threshold
}
