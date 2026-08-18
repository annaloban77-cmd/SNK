// paddle-ocr.ts — Node-клиент для PaddleOCR sidecar
// Вызывает Python FastAPI на порту 8100
// Возвращает text, confidence, bounding boxes каждого слова
// 1.1: Downscale изображений до 1500px max перед отправкой (лечит OOM)

import { readFile } from 'fs/promises'
import sharp from 'sharp'

const PADDLE_URL = process.env.OCR_SIDECAR_URL || 'http://localhost:8100'
const MAX_LONG_SIDE = 1000 // px — если больше, downscale

export interface PaddleWord {
  text: string
  box: number[][]  // [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
  conf: number
}

export interface PaddleResult {
  text: string
  confidence: number
  boxes: number[][][]
  words: PaddleWord[]
}

// Проверка доступности PaddleOCR
export async function isPaddleAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${PADDLE_URL}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

// 1.1: Downscale изображения если длинная сторона > MAX_LONG_SIDE
// Возвращает base64 PNG (сжатый) + scale factor
async function downscaleForOcr(filePath: string): Promise<{ base64: string; scale: number; origW: number; origH: number }> {
  const img = sharp(filePath)
  const meta = await img.metadata()
  const origW = meta.width || 1000
  const origH = meta.height || 1414
  const longSide = Math.max(origW, origH)

  if (longSide <= MAX_LONG_SIDE) {
    // Не нужно сжимать
    const buf = await readFile(filePath)
    return { base64: buf.toString('base64'), scale: 1, origW, origH }
  }

  // Сжимаем
  const scale = MAX_LONG_SIDE / longSide
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)
  const resized = await img
    .resize(newW, newH, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer()

  console.log(`[PaddleOCR] Downscaled: ${origW}x${origH} → ${newW}x${newH} (scale=${scale.toFixed(2)})`)
  return { base64: resized.toString('base64'), scale, origW, origH }
}

// Полный OCR изображения (с downscale)
export async function paddleOcr(filePath: string): Promise<PaddleResult | null> {
  try {
    const { base64, scale } = await downscaleForOcr(filePath)

    const res = await fetch(`${PADDLE_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    })

    if (!res.ok) {
      console.error('[PaddleOCR] HTTP error:', res.status)
      return null
    }

    const result = await res.json() as PaddleResult

    // Если был downscale — корректируем координаты bounding boxes обратно
    if (scale !== 1 && result.words) {
      const invScale = 1 / scale
      result.words = result.words.map(w => ({
        ...w,
        box: w.box.map(p => [p[0] * invScale, p[1] * invScale]) as number[][],
      }))
      result.boxes = result.boxes.map(b => b.map(p => [p[0] * invScale, p[1] * invScale]) as number[][])
    }

    return result
  } catch (e) {
    console.error('[PaddleOCR] Failed:', e)
    return null
  }
}

// Zone OCR — кроп области + распознавание
export async function paddleOcrZone(
  filePath: string,
  zone: { x: number; y: number; w: number; h: number }
): Promise<PaddleResult | null> {
  try {
    // Кропаем зону локально через sharp (меньше данных в sidecar)
    const img = sharp(filePath)
    const meta = await img.metadata()
    const origW = meta.width || 1000
    const origH = meta.height || 1414

    // Апскейл зоны ×3 для лучшего OCR
    const scaleFactor = 3
    const cropped = await img
      .extract({
        left: Math.min(zone.x, origW - zone.w - 1),
        top: Math.min(zone.y, origH - zone.h - 1),
        width: Math.min(zone.w, origW - zone.x - 1),
        height: Math.min(zone.h, origH - zone.y - 1),
      })
      .resize(zone.w * scaleFactor, zone.h * scaleFactor, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer()

    const base64 = cropped.toString('base64')

    const res = await fetch(`${PADDLE_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    })

    if (!res.ok) {
      console.error('[PaddleOCR Zone] HTTP error:', res.status)
      return null
    }

    const result = await res.json() as PaddleResult

    // Корректируем координаты обратно к оригинальному изображению
    if (result.words) {
      const invScale = 1 / scaleFactor
      result.words = result.words.map(w => ({
        ...w,
        box: w.box.map(p => [
          (p[0] * invScale) + zone.x,
          (p[1] * invScale) + zone.y,
        ]) as number[][],
      }))
    }

    return result
  } catch (e) {
    console.error('[PaddleOCR Zone] Failed:', e)
    return null
  }
}

// Вычисление центра bounding box (в пикселях)
export function boxCenter(box: number[][]): { x: number; y: number } {
  // box = [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
  const cx = (box[0][0] + box[2][0]) / 2
  const cy = (box[0][1] + box[2][1]) / 2
  return { x: cx, y: cy }
}

// Конвертация пиксельных координат в мм (нужен DPI)
export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * 25.4
}
