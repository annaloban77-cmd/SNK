// Генератор 30 деградированных семплов для тестирования robustness OCR
// Берёт существующие SVG-семплы, рендерит в PNG, применяет деградацию:
// - перекос 0.5-3°
// - гауссов шум
// - blur (motion + gaussian)
// - DPI 150-300 (разные размеры)
// - выцветание (снижение контраста)
// - рукописные пометки (линии поверх)
// Expected = тот же что у оригинала (деградация не должна менять findings)

import sharp from 'sharp'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SRC_SVG_DIR = '/home/z/my-project/public/bench/svg'
const OUT_DIR = '/home/z/my-project/public/bench/degraded'
const EXPECTED_DIR = '/home/z/my-project/public/bench/expected'

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// Применить деградацию к PNG-буферу
async function degrade(
  pngBuf: Buffer,
  rng: () => number,
  opts: { skewDeg: number; noiseLevel: number; blurSigma: number; contrast: number; dpi: number; marks: number }
): Promise<Buffer> {
  let img = sharp(pngBuf)
  const meta = await img.metadata()
  const w = meta.width || 1000
  const h = meta.height || 1414

  // 1. Перекос (affine rotation)
  if (Math.abs(opts.skewDeg) > 0.1) {
    const rad = (opts.skewDeg * Math.PI) / 180
    // sharp rotate с фоном white
    img = img.rotate(opts.skewDeg, { background: { r: 255, g: 255, b: 255 } })
  }

  // 2. DPI-масштабирование (симулируем разный DPI сканера)
  const scale = opts.dpi / 200 // 200 = базовый DPI наших PNG
  if (scale < 0.9 || scale > 1.1) {
    const newW = Math.round(w * scale)
    const newH = Math.round(h * scale)
    img = img.resize(newW, newH, { fit: 'fill' })
  }

  // 3. Выцветание (снижение контраста)
  if (opts.contrast < 0.95) {
    // Делаем фон слегка серым, линии менее контрастными
    img = img.modulate({ brightness: 1.0, saturation: 0.7 })
    // Снижение контраста через linear
    const factor = opts.contrast
    img = img.linear(factor, 128 * (1 - factor))
  }

  // 4. Blur
  if (opts.blurSigma > 0.3) {
    img = img.blur(opts.blurSigma)
  }

  // 5. Гауссов шум — через raw buffer с случайными значениями
  if (opts.noiseLevel > 5) {
    const noiseW = Math.min(w, 400)
    const noiseH = Math.min(h, 400)
    // Генерируем шумовой raw buffer
    const noiseRaw = Buffer.alloc(noiseW * noiseH * 3)
    for (let i = 0; i < noiseRaw.length; i++) {
      noiseRaw[i] = Math.floor(Math.random() * 256)
    }
    const noiseOverlay = await sharp(noiseRaw, {
      raw: { width: noiseW, height: noiseH, channels: 3 },
    })
      .png()
      .toBuffer()
    img = img.composite([
      {
        input: noiseOverlay,
        blend: 'overlay',
        
        tile: true,
      },
    ])
  }

  return img.png().toBuffer()
}

// Добавить рукописные пометки (случайные линии поверх чертежа)
async function addHandwrittenMarks(pngBuf: Buffer, rng: () => number, count: number): Promise<Buffer> {
  const meta = await sharp(pngBuf).metadata()
  const w = meta.width || 1000
  const h = meta.height || 1414

  // Генерируем SVG с случайными "рукописными" линиями
  let marksSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  for (let i = 0; i < count; i++) {
    const x1 = Math.floor(rng() * w)
    const y1 = Math.floor(rng() * h)
    const x2 = x1 + Math.floor((rng() - 0.5) * 200)
    const y2 = y1 + Math.floor((rng() - 0.5) * 100)
    const color = rng() > 0.5 ? '#0000ff' : '#ff0000' // синяя или красная ручка
    const sw = rng() > 0.5 ? 1.5 : 2.5
    marksSvg += `<path d="M${x1},${y1} Q${(x1+x2)/2+rng()*40-20},${(y1+y2)/2+rng()*30-15} ${x2},${y2}" stroke="${color}" stroke-width="${sw}" fill="none" opacity="0.7"/>`
  }
  marksSvg += `</svg>`

  const marksBuf = Buffer.from(marksSvg)
  return sharp(pngBuf).composite([{ input: marksBuf, blend: 'over' }]).png().toBuffer()
}

async function main() {
  console.log('🏗 Generating 30 degraded bench samples...')
  await mkdir(OUT_DIR, { recursive: true })

  // Возьмём 15 correct (S-001..S-015) и 15 with_errors (E-001..E-015)
  const correctCodes = Array.from({ length: 15 }, (_, i) => `S-${String(i + 1).padStart(3, '0')}`)
  const errorCodes = Array.from({ length: 15 }, (_, i) => `E-${String(i + 1).padStart(3, '0')}`)
  const allCodes = [...correctCodes, ...errorCodes]

  const manifest: { code: string; originalCode: string; title: string; category: string; format: string; sourceType: string; degradation: string; expectedCount: number; expectedHigh: number; expectedMedium: number; expectedLow: number; expectedCategories: string[] }[] = []

  let idx = 1
  for (const origCode of allCodes) {
    const rng = makeRng(5000 + idx)
    const svgPath = path.join(SRC_SVG_DIR, `${origCode}.svg`)
    if (!existsSync(svgPath)) {
      console.log(`  ⚠ ${origCode}.svg not found, skipping`)
      continue
    }

    const svg = await readFile(svgPath)
    // Рендерим оригинальный PNG
    const origPng = await sharp(svg).png().toBuffer()

    // Параметры деградации
    const skewDeg = +(rng() * 5 - 2.5).toFixed(1) // -2.5..+2.5°
    const noiseLevel = Math.floor(rng() * 30 + 5) // 5..35
    const blurSigma = +(rng() * 1.2).toFixed(1) // 0..1.2
    const contrast = +(rng() * 0.25 + 0.75).toFixed(2) // 0.75..1.0
    const dpi = [150, 200, 250, 300][Math.floor(rng() * 4)]
    const marks = Math.floor(rng() * 4) // 0..3 рукописных пометок

    // Применяем деградацию
    let degraded = await degrade(origPng, rng, { skewDeg, noiseLevel, blurSigma, contrast, dpi, marks })

    // Добавляем рукописные пометки
    if (marks > 0) {
      degraded = await addHandwrittenMarks(degraded, rng, marks)
    }

    const code = `D-${String(idx).padStart(3, '0')}`
    const outPath = path.join(OUT_DIR, `${code}.png`)
    await sharp(degraded).png().toFile(outPath)

    // Копируем expected из оригинала
    const origExpectedPath = path.join(EXPECTED_DIR, `${origCode}.json`)
    let expectedCount = 0, expectedHigh = 0, expectedMedium = 0, expectedLow = 0
    let expectedCategories: string[] = []
    let category = 'correct'
    if (existsSync(origExpectedPath)) {
      const exp = JSON.parse(await readFile(origExpectedPath, 'utf-8'))
      expectedCount = exp.findings.length
      expectedHigh = exp.findings.filter((f: any) => f.severity === 'high').length
      expectedMedium = exp.findings.filter((f: any) => f.severity === 'medium').length
      expectedLow = exp.findings.filter((f: any) => f.severity === 'low').length
      expectedCategories = [...new Set(exp.findings.map((f: any) => f.code.split('-')[1].toLowerCase()))] as string[]
      category = 'with_errors'
      // Копируем expected JSON с новым кодом
      const newExp = { ...exp, code, sample: code }
      await writeFile(path.join(EXPECTED_DIR, `${code}.json`), JSON.stringify(newExp, null, 2))
    }

    const degradDesc = `skew=${skewDeg}°, noise=${noiseLevel}, blur=${blurSigma}, contrast=${contrast}, dpi=${dpi}, marks=${marks}`
    manifest.push({
      code, originalCode: origCode,
      title: `${origCode} (деградированный: ${degradDesc})`,
      category, format: 'A3', sourceType: 'scan',
      degradation: degradDesc,
      expectedCount, expectedHigh, expectedMedium, expectedLow, expectedCategories,
    })
    console.log(`  ✓ ${code} ← ${origCode} (${degradDesc})`)
    idx++
  }

  await writeFile('/home/z/my-project/public/bench/degraded-manifest.json', JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Generated ${manifest.length} degraded samples`)
  console.log(`   Correct: ${manifest.filter(m => m.category === 'correct').length}`)
  console.log(`   With errors: ${manifest.filter(m => m.category === 'with_errors').length}`)
  console.log(`   Total expected findings: ${manifest.reduce((s, m) => s + m.expectedCount, 0)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
