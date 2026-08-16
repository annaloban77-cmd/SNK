// geometry-checker.ts — детекция линий, рамок, элементов чертежа
// Детерминированная геометрическая проверка (P5: без VLM)
//
// Для SVG-семплов: парсинг <line>, <rect>, <circle> напрямую
// Для PNG: анализ через sharp (гистограммы, профили)

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import sharp from 'sharp'

export interface GeometryFinding {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  field: string
  description: string
  confidence: number
}

export interface GeometryAnalysis {
  hasFrame: boolean
  frameBounds?: { x: number; y: number; w: number; h: number }
  hasTitleBlock: boolean
  titleBlockBounds?: { x: number; y: number; w: number; h: number }
  lineCount: number
  circleCount: number
  textCount: number
  dimensionCount: number
  hasDimensions: boolean
  hasProjections: boolean
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  findings: GeometryFinding[]
  method: 'svg' | 'image' | 'none'
}

// Главный метод
export async function analyzeGeometry(filePath: string): Promise<GeometryAnalysis> {
  const svgPath = filePath.replace(/\.png$|\.jpg$|\.jpeg$/i, '.svg').replace('/samples/', '/svg/')
  if (existsSync(svgPath)) {
    try {
      const svg = await readFile(svgPath, 'utf-8')
      return analyzeSvgGeometry(svg)
    } catch {}
  }
  // Для PNG — базовый анализ через sharp
  if (/\.(png|jpg|jpeg)$/i.test(filePath)) {
    return analyzeImageGeometry(filePath)
  }
  return {
    hasFrame: false, hasTitleBlock: false, lineCount: 0, circleCount: 0,
    textCount: 0, dimensionCount: 0, hasDimensions: false, hasProjections: false,
    findings: [], method: 'none',
  }
}

// ============ SVG-анализ (детерминированный) ============
function analyzeSvgGeometry(svg: string): GeometryAnalysis {
  const lines = [...svg.matchAll(/<line\b[^>]*>/gi)]
  const rects = [...svg.matchAll(/<rect\b[^>]*>/gi)]
  const circles = [...svg.matchAll(/<circle\b[^>]*>/gi)]
  const texts = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/gi)]
  const polylines = [...svg.matchAll(/<polyline\b[^>]*>/gi)]
  const polygons = [...svg.matchAll(/<polygon\b[^>]*>/gi)]

  const lineCount = lines.length + polylines.length + polygons.length
  const circleCount = circles.length
  const textCount = texts.filter(m => m[1].trim()).length

  // Размеры SVG
  const sizeMatch = svg.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/i)
  const svgW = sizeMatch ? parseInt(sizeMatch[1]) : 1000
  const svgH = sizeMatch ? parseInt(sizeMatch[2]) : 1414

  // Ищем внешнюю рамку (rect с координатами ~20,20 и размером почти весь SVG)
  let hasFrame = false
  let frameBounds: GeometryAnalysis['frameBounds'] | undefined
  for (const r of rects) {
    const m = r[0].match(/x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/i)
    if (m) {
      const x = parseFloat(m[1]), y = parseFloat(m[2]), w = parseFloat(m[3]), h = parseFloat(m[4])
      // Рамка: начинается около 20, размер близок к SVG
      if (x < 30 && y < 30 && w > svgW * 0.9 && h > svgH * 0.9) {
        hasFrame = true
        frameBounds = { x, y, w, h }
      }
    }
  }

  // Ищем штамп — в SVG он внутри группы с комментарием <!-- Штамп ГОСТ 2.104 ... -->
  // или rect ~340×180 внутри <g transform="translate(...)">
  let hasTitleBlock = false
  let titleBlockBounds: GeometryAnalysis['titleBlockBounds'] | undefined

  // Способ 1: по комментарию
  if (/<!--\s*Штамп\s+ГОСТ/i.test(svg)) {
    hasTitleBlock = true
    // Найдём transform группы штампа
    const stampCommentIdx = svg.indexOf('<!-- Штамп')
    const beforeComment = svg.slice(0, stampCommentIdx)
    const transforms = [...beforeComment.matchAll(/<g transform="translate\(([\d.]+),\s*([\d.]+)\)">/g)]
    const lastTransform = transforms[transforms.length - 1]
    if (lastTransform) {
      titleBlockBounds = {
        x: parseInt(lastTransform[1]),
        y: parseInt(lastTransform[2]),
        w: 340, h: 180,
      }
    }
  }

  // Способ 2: по размеру rect внутри <g> в правой нижней зоне
  if (!hasTitleBlock) {
    for (const r of rects) {
      const m = r[0].match(/x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/i)
      if (m) {
        const w = parseFloat(m[3]), h = parseFloat(m[4])
        if (w > 200 && w < 500 && h > 100 && h < 250) {
          hasTitleBlock = true
          titleBlockBounds = { x: parseFloat(m[1]), y: parseFloat(m[2]), w, h }
          break
        }
      }
    }
  }

  // Размеры — ищем тексты-числа рядом с размерными линиями (упрощённо)
  const dimensionCount = texts.filter(m => /^\d+$/.test(m[1].trim()) && m[1].trim().length <= 4).length
  const hasDimensions = dimensionCount > 0

  // Проекции — есть ли circle/rect в центральной области (не штамп)
  const hasProjections = circles.some(c => {
    const m = c[0].match(/cx="([\d.]+)"[^>]*cy="([\d.]+)"/i)
    if (!m) return false
    const cx = parseFloat(m[1])
    return cx < svgW * 0.6 // не в зоне штампа
  })

  const findings: GeometryFinding[] = []
  if (!hasFrame) {
    findings.push({
      code: 'R-FORMAT-003', title: 'Наличие внешней рамки', severity: 'medium', field: 'Рамка',
      description: 'Внешняя рамка не обнаружена. По ГОСТ 2.301 внешняя рамка обязательна.',
      confidence: 0.9,
    })
  }
  if (!hasTitleBlock) {
    findings.push({
      code: 'R-STAMP-000', title: 'Основная надпись не обнаружена', severity: 'high', field: 'Штамп',
      description: 'Штамп (основная надпись) не найден в нижнем правом углу. По ГОСТ 2.104 обязателен.',
      confidence: 0.9,
    })
  }
  if (!hasDimensions) {
    findings.push({
      code: 'R-DIM-001', title: 'Размеры не указаны', severity: 'high', field: 'Размеры',
      description: 'На чертеже не обнаружены размерные линии. По ГОСТ 2.307 размеры обязательны.',
      confidence: 0.7,
    })
  }
  if (!hasProjections) {
    findings.push({
      code: 'R-VIEW-002', title: 'Необходимые виды', severity: 'medium', field: 'Геометрия',
      description: 'Не обнаружены графические проекции изделия. По ГОСТ 2.305 виды обязательны.',
      confidence: 0.6,
    })
  }

  return {
    hasFrame, frameBounds, hasTitleBlock, titleBlockBounds,
    lineCount, circleCount, textCount, dimensionCount,
    hasDimensions, hasProjections,
    bounds: frameBounds ? { minX: frameBounds.x, minY: frameBounds.y, maxX: frameBounds.x + frameBounds.w, maxY: frameBounds.y + frameBounds.h } : undefined,
    findings, method: 'svg',
  }
}

// ============ Image-анализ (через sharp, базовый) ============
async function analyzeImageGeometry(filePath: string): Promise<GeometryAnalysis> {
  try {
    const metadata = await sharp(filePath).metadata()
    const { width = 0, height = 0 } = metadata

    // Грубый анализ: ищем тёмные пиксели по краям (рамка)
    // Берём профиль по верхней строке и ищем тёмные участки
    const { data } = await sharp(filePath).greyscale().raw().toBuffer({ resolveWithObject: true })
    const channels = metadata.channels || 1

    let hasFrame = false
    let lineCount = 0
    // Сканируем горизонтальные линии: если в строке >30% тёмных пикселей — это линия
    for (let y = 0; y < height; y += 1) {
      let dark = 0
      for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 100))) {
        const idx = (y * width + x) * channels
        if (data[idx] < 128) dark++
      }
      if (dark > 30) lineCount++
    }
    hasFrame = lineCount > 4 // минимум 4 линии рамки

    return {
      hasFrame, hasTitleBlock: false, // сложно определить без VLM
      lineCount, circleCount: 0, textCount: 0, dimensionCount: 0,
      hasDimensions: false, hasProjections: lineCount > 10,
      bounds: hasFrame ? { minX: 20, minY: 20, maxX: width - 20, maxY: height - 20 } : undefined,
      findings: [], method: 'image',
    }
  } catch (e) {
    return {
      hasFrame: false, hasTitleBlock: false, lineCount: 0, circleCount: 0,
      textCount: 0, dimensionCount: 0, hasDimensions: false, hasProjections: false,
      findings: [], method: 'none',
    }
  }
}
