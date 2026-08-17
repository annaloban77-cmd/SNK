// paddle-ocr.ts — Node-клиент для PaddleOCR sidecar
// Вызывает Python FastAPI на порту 8100
// Возвращает text, confidence, bounding boxes каждого слова

import { readFile } from 'fs/promises'

const PADDLE_URL = process.env.OCR_SIDECAR_URL || 'http://localhost:8100'

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

// Полный OCR изображения
export async function paddleOcr(filePath: string): Promise<PaddleResult | null> {
  try {
    const buf = await readFile(filePath)
    const base64 = buf.toString('base64')

    const res = await fetch(`${PADDLE_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    })

    if (!res.ok) {
      console.error('[PaddleOCR] HTTP error:', res.status)
      return null
    }

    return await res.json() as PaddleResult
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
    const buf = await readFile(filePath)
    const base64 = buf.toString('base64')

    const res = await fetch(`${PADDLE_URL}/ocr_zone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64,
        x: zone.x, y: zone.y, w: zone.w, h: zone.h,
      }),
    })

    if (!res.ok) {
      console.error('[PaddleOCR Zone] HTTP error:', res.status)
      return null
    }

    return await res.json() as PaddleResult
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
