// preprocess.ts — препроцессинг сканов для OCR
// deskew (по проекциям), бинаризация (Otsu), денуаз, DPI-калибровка
// Без OpenCV — только sharp + вычисления на raw buffer

import sharp from 'sharp'

export interface PreprocessResult {
  processed: Buffer // обработанное PNG-изображение
  width: number
  height: number
  skewAngle: number // определённый угол перекоса (градусы)
  dpi: number // определённый DPI
  formatMm: { w: number; h: number } | null // размер листа в мм
  stampRegion: { x: number; y: number; w: number; h: number } | null // область штампа в пикселях
}

// Главный метод — полная预处理ка
export async function preprocessScan(filePath: string): Promise<PreprocessResult> {
  const img = sharp(filePath)
  const meta = await img.metadata()
  const origW = meta.width || 1000
  const origH = meta.height || 1414

  // 1. Конвертация в grayscale
  let processed = img.grayscale()

  // 2. Deskew — определяем угол перекоса по проекциям
  const skewAngle = await detectSkewAngle(filePath, origW, origH)
  if (Math.abs(skewAngle) > 0.2) {
    processed = processed.rotate(skewAngle, { background: { r: 255, g: 255, b: 255 } })
  }

  // 3. Бинаризация — Otsu через threshold
  // Загружаем raw, применяем Otsu, возвращаем
  const grayBuf = await processed.raw().toBuffer({ resolveWithObject: true })
  const threshold = otsuThreshold(grayBuf.data)
  const binaryBuf = Buffer.alloc(grayBuf.data.length)
  for (let i = 0; i < grayBuf.data.length; i++) {
    binaryBuf[i] = grayBuf.data[i] < threshold ? 0 : 255
  }

  // 4. Денуаз — медианный фильтр 3×3
  const denoised = medianFilter(binaryBuf, grayBuf.info.width, grayBuf.info.height, 3)

  // Конвертируем обратно в PNG
  const processedPng = await sharp(denoised, {
    raw: { width: grayBuf.info.width, height: grayBuf.info.height, channels: 1 },
  })
    .png()
    .toBuffer()

  const w = grayBuf.info.width
  const h = grayBuf.info.height

  // 5. DPI-калибровка — определяем формат листа по соотношению сторон
  const aspectRatio = w / h
  let formatMm: { w: number; h: number } | null = null
  let dpi = 200

  // A4: 210×297 = 0.707, A3: 297×420 = 0.707, A2: 420×594 = 0.707
  // Все форматы имеют одинаковое соотношение √2 ≈ 1.414
  // Различаем по размеру: A4 ~1000px, A3 ~1414px, A2 ~2000px при 200 DPI
  const longSide = Math.max(w, h)
  if (longSide < 1200) {
    formatMm = { w: 210, h: 297 } // A4
    dpi = Math.round(longSide / 297 * 25.4)
  } else if (longSide < 1800) {
    formatMm = { w: 297, h: 420 } // A3
    dpi = Math.round(longSide / 420 * 25.4)
  } else {
    formatMm = { w: 420, h: 594 } // A2
    dpi = Math.round(longSide / 594 * 25.4)
  }

  // 6. Определение области штампа
  // Штамп ГОСТ 2.104 форма 1: 185×55 мм, в правом нижнем углу
  // В пикселях: (dpi/25.4) * мм
  const pxPerMm = dpi / 25.4
  const stampWMm = 185
  const stampHMm = 55
  const stampWpx = Math.round(stampWMm * pxPerMm)
  const stampHpx = Math.round(stampHMm * pxPerMm * 3.3) // штамп занимает ~3 строки высоты
  // Положение: правый нижний угол, отступ ~5мм от края рамки
  const margin = Math.round(5 * pxPerMm)
  const stampX = w - stampWpx - margin
  const stampY = h - stampHpx - margin

  const stampRegion = stampX > 0 && stampY > 0 ? { x: stampX, y: stampY, w: stampWpx, h: stampHpx } : null

  return {
    processed: processedPng,
    width: w,
    height: h,
    skewAngle,
    dpi,
    formatMm,
    stampRegion,
  }
}

// Детекция угла перекоса по проекциям (row profile variance)
async function detectSkewAngle(filePath: string, w: number, h: number): Promise<number> {
  // Уменьшаем для скорости
  const scale = Math.min(1, 500 / Math.max(w, h))
  const smallW = Math.round(w * scale)
  const smallH = Math.round(h * scale)

  const grayBuf = await sharp(filePath)
    .grayscale()
    .resize(smallW, smallH)
    .raw()
    .toBuffer()

  // Бинаризуем
  const threshold = otsuThreshold(grayBuf)
  const binary = Buffer.alloc(grayBuf.length)
  for (let i = 0; i < grayBuf.length; i++) {
    binary[i] = grayBuf[i] < threshold ? 1 : 0
  }

  // Пробуем углы от -5° до +5° с шагом 0.5°
  let bestAngle = 0
  let bestScore = -1

  for (let angle = -5; angle <= 5; angle += 0.5) {
    // Для каждого угла: поворачиваем бинарное изображение и считаем "пиковость" проекции
    const score = computeProjectionScore(binary, smallW, smallH, angle)
    if (score > bestScore) {
      bestScore = score
      bestAngle = angle
    }
  }

  // Уточнение: ±0.25° от лучшего
  for (let angle = bestAngle - 0.25; angle <= bestAngle + 0.25; angle += 0.1) {
    const score = computeProjectionScore(binary, smallW, smallH, angle)
    if (score > bestScore) {
      bestScore = score
      bestAngle = Math.round(angle * 10) / 10
    }
  }

  return bestAngle
}

// Вычисление "пиковости" проекции для данного угла
// Для правильно выровненного изображения горизонтальные линии дают резкие пики
function computeProjectionScore(binary: Buffer, w: number, h: number, angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = w / 2
  const cy = h / 2

  // Считаем投影 — сумму тёмных пикселей по каждой строке
  const rowSums = new Float64Array(h)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = 0; x < w; x++) {
      // Обратный поворот: где в исходном изображении находится точка (x,y) после поворота на -angle
      const dx = x - cx
      const dy = y - cy
      const srcX = Math.round(cx + dx * cos + dy * sin)
      const srcY = Math.round(cy - dx * sin + dy * cos)
      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        sum += binary[srcY * w + srcX]
      }
    }
    rowSums[y] = sum
  }

  // Считаем дисперсию проекции — чем больше, тем "пиковее" (более выровнено)
  const mean = rowSums.reduce((a, b) => a + b, 0) / h
  let variance = 0
  for (let i = 0; i < h; i++) {
    variance += (rowSums[i] - mean) ** 2
  }
  return variance / h
}

// Otsu threshold — автоматический порог бинаризации
function otsuThreshold(data: Buffer): number {
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++
  }
  const total = data.length

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumB = 0
  let wB = 0
  let maxVariance = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) ** 2
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }
  return threshold
}

// Медианный фильтр — денуаз
function medianFilter(data: Buffer, w: number, h: number, size: number): Buffer {
  const half = Math.floor(size / 2)
  const result = Buffer.alloc(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const values: number[] = []
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            values.push(data[ny * w + nx])
          }
        }
      }
      values.sort((a, b) => a - b)
      result[y * w + x] = values[Math.floor(values.length / 2)]
    }
  }
  return result
}

// Кроп и апскейл области для zone-OCR
export async function cropAndUpscale(
  filePath: string,
  region: { x: number; y: number; w: number; h: number },
  scaleFactor: number = 2
): Promise<Buffer> {
  return sharp(filePath)
    .extract({
      left: Math.max(0, Math.round(region.x)),
      top: Math.max(0, Math.round(region.y)),
      width: Math.min(region.w, 2000),
      height: Math.min(region.h, 1000),
    })
    .resize(Math.round(region.w * scaleFactor), Math.round(region.h * scaleFactor), {
      fit: 'fill',
      kernel: 'lanczos3',
    })
    .grayscale()
    .sharpen()
    .png()
    .toBuffer()
}
