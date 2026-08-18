// Генератор REALISTIC тира бенча: мягкая деградация (как реальные сканы хорошего качества)
// Перекос 0.3-1°, DPI 200-300, шум σ≤10, blur ≤0.5, выцветание минимальное
// В отличие от деградированного (перекос до 3°, blur до 1.2, шум до 35)

import sharp from 'sharp'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SRC_SVG_DIR = '/home/z/my-project/public/bench/svg'
const OUT_DIR = '/home/z/my-project/public/bench/realistic'
const EXPECTED_DIR = '/home/z/my-project/public/bench/expected'

function makeRng(seed: number) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

async function degradeRealistic(pngBuf: Buffer, rng: () => number): Promise<Buffer> {
  let img = sharp(pngBuf)
  const meta = await img.metadata()
  const w = meta.width || 1000
  const h = meta.height || 1414

  // 1. Перекос 0.3-1° (реалистичный для сканеров)
  const skewDeg = +(rng() * 0.7 + 0.3).toFixed(1) * (rng() > 0.5 ? 1 : -1)
  img = img.rotate(skewDeg, { background: { r: 255, g: 255, b: 255 } })

  // 2. DPI 200-300 (разные размеры)
  const dpi = [200, 250, 300][Math.floor(rng() * 3)]
  const scale = dpi / 200
  if (scale < 0.95 || scale > 1.05) {
    img = img.resize(Math.round(w * scale), Math.round(h * scale), { fit: 'fill' })
  }

  // 3. Лёгкий blur ≤0.5 (реалистичный для сканов)
  const blurSigma = +(rng() * 0.4).toFixed(1)
  if (blurSigma > 0.2) img = img.blur(blurSigma)

  // 4. Лёгкое выцветание (контраст 0.90-1.0)
  const contrast = +(rng() * 0.10 + 0.90).toFixed(2)
  if (contrast < 0.98) {
    img = img.linear(contrast, 128 * (1 - contrast))
  }

  // 5. Минимальный шум σ≤10 (почти незаметный)
  const noiseLevel = Math.floor(rng() * 8 + 2) // 2-10
  if (noiseLevel > 3) {
    const noiseW = Math.min(w, 400)
    const noiseH = Math.min(h, 400)
    const noiseRaw = Buffer.alloc(noiseW * noiseH * 3)
    for (let i = 0; i < noiseRaw.length; i++) {
      noiseRaw[i] = Math.floor(Math.random() * 256)
    }
    const noiseOverlay = await sharp(noiseRaw, {
      raw: { width: noiseW, height: noiseH, channels: 3 },
    }).png().toBuffer()
    img = img.composite([{
      input: noiseOverlay,
      blend: 'overlay',
      tile: true,
    }])
  }

  return img.png().toBuffer()
}

async function main() {
  console.log('📐 Generating REALISTIC bench samples (soft degradation)...')
  await mkdir(OUT_DIR, { recursive: true })

  const correctCodes = Array.from({ length: 15 }, (_, i) => `S-${String(i + 1).padStart(3, '0')}`)
  const errorCodes = Array.from({ length: 15 }, (_, i) => `E-${String(i + 1).padStart(3, '0')}`)
  const allCodes = [...correctCodes, ...errorCodes]

  const manifest: any[] = []
  let idx = 1

  for (const origCode of allCodes) {
    const rng = makeRng(9000 + idx)
    const svgPath = path.join(SRC_SVG_DIR, `${origCode}.svg`)
    if (!existsSync(svgPath)) continue

    const svg = await readFile(svgPath)
    const origPng = await sharp(svg).png().toBuffer()
    const degraded = await degradeRealistic(origPng, rng)

    const code = `R-${String(idx).padStart(3, '0')}`
    const outPath = path.join(OUT_DIR, `${code}.png`)
    await sharp(degraded).png().toFile(outPath)

    // Копируем expected
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
      const newExp = { ...exp, code, sample: code }
      await writeFile(path.join(EXPECTED_DIR, `${code}.json`), JSON.stringify(newExp, null, 2))
    }

    const skewDeg = '0.3-1°'
    const degradDesc = `realistic: skew=${skewDeg}, dpi=200-300, blur≤0.5, noise≤10`
    manifest.push({
      code, originalCode: origCode,
      title: `${origCode} (${degradDesc})`,
      category, format: 'A3', sourceType: 'scan',
      degradation: degradDesc,
      expectedCount, expectedHigh, expectedMedium, expectedLow, expectedCategories,
    })
    idx++
  }

  await writeFile('/home/z/my-project/public/bench/realistic-manifest.json', JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Generated ${manifest.length} REALISTIC samples`)
  console.log(`   Correct: ${manifest.filter(m => m.category === 'correct').length}`)
  console.log(`   With errors: ${manifest.filter(m => m.category === 'with_errors').length}`)
  console.log(`   Total expected findings: ${manifest.reduce((s, m) => s + m.expectedCount, 0)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
