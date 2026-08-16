// scripts/generate-samples.ts
// Generates two PNG sample engineering drawings (Russian style, per ГОСТ 2.104 form 1)
// using SVG templates rendered to PNG via sharp.
//
// Output:
//   public/samples/sample-1-kronshtein.png  (A3 landscape, ~1600x1131)
//   public/samples/sample-2-flanets.png    (A4 portrait, ~1000x1414)
//
// Run: bun run scripts/generate-samples.ts

import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'samples')

interface StampData {
  format: 'A3' | 'A4'
  designation: string
  name: string
  scale: string
  mass: string
  material: string
  letter: string
  stage: string
  signatures: {
    developed: string
    checked: string
    normControl: string
    approved: string
  }
  dates: {
    developed: string
    checked: string
    approved: string
  }
  technicalRequirements: string[]
  gostReferences: string[]
  documentType: string
}

// ===== A3 landscape template (Кронштейн) =====
// Canvas: 1600x1131. Frame border at 40px from edges.
function renderA3(s: StampData): string {
  const W = 1600
  const H = 1131
  // Title block (штамп) — bottom-right corner per ГОСТ 2.104 form 1 (simplified)
  // Position: x = 1130, y = 920, width = 430, height = 171
  const tbX = 1130
  const tbY = 920
  const tbW = 430
  const tbH = 171

  // Helpers
  const T = (x: number, y: number, text: string, opts: { size?: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rotate?: number } = {}) => {
    const size = opts.size ?? 11
    const anchor = opts.anchor ?? 'start'
    const weight = opts.bold ? 'bold' : 'normal'
    const rot = opts.rotate ? ` transform="rotate(${opts.rotate} ${x} ${y})"` : ''
    return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#000"${rot}>${escapeXml(text)}</text>`
  }
  const L = (x1: number, y1: number, x2: number, y2: number, w = 1) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}" />`
  const R = (x: number, y: number, w: number, h: number, fill = 'none') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#000" stroke-width="1" />`

  // ===== Drawing area geometry (simple bracket) =====
  const cx = 600
  const cy = 480
  const drawingSvg = `
    <!-- Main view: L-shaped bracket -->
    <rect x="${cx - 180}" y="${cy - 120}" width="160" height="240" fill="none" stroke="#000" stroke-width="2" />
    <rect x="${cx - 20}" y="${cy - 80}" width="160" height="160" fill="none" stroke="#000" stroke-width="2" />
    <line x1="${cx - 180}" y1="${cy + 120}" x2="${cx + 140}" y2="${cy + 120}" stroke="#000" stroke-width="1" stroke-dasharray="6,3,2,3" />
    <line x1="${cx + 140}" y1="${cy - 120}" x2="${cx + 140}" y2="${cy + 120}" stroke="#000" stroke-width="1" stroke-dasharray="6,3,2,3" />
    <!-- Mounting holes -->
    <circle cx="${cx - 100}" cy="${cy - 60}" r="18" fill="none" stroke="#000" stroke-width="1.5" />
    <circle cx="${cx - 100}" cy="${cy - 60}" r="9" fill="none" stroke="#000" stroke-width="1" />
    <circle cx="${cx - 100}" cy="${cy + 60}" r="18" fill="none" stroke="#000" stroke-width="1.5" />
    <circle cx="${cx - 100}" cy="${cy + 60}" r="9" fill="none" stroke="#000" stroke-width="1" />
    <circle cx="${cx + 60}" cy="${cy}" r="30" fill="none" stroke="#000" stroke-width="1.5" />
    <circle cx="${cx + 60}" cy="${cy}" r="15" fill="none" stroke="#000" stroke-width="1" />
    <!-- Dimension lines -->
    <line x1="${cx - 180}" y1="${cy + 160}" x2="${cx - 20}" y2="${cy + 160}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 180}" y1="${cy + 155}" x2="${cx - 180}" y2="${cy + 165}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 20}" y1="${cy + 155}" x2="${cx - 20}" y2="${cy + 165}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 20}" y1="${cy + 160}" x2="${cx + 140}" y2="${cy + 160}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx + 140}" y1="${cy + 155}" x2="${cx + 140}" y2="${cy + 165}" stroke="#000" stroke-width="0.8" />
    ${T(cx - 100, cy + 178, '160', { size: 11, anchor: 'middle' })}
    ${T(cx + 60, cy + 178, '160', { size: 11, anchor: 'middle' })}
    <!-- Vertical dimensions -->
    <line x1="${cx - 220}" y1="${cy - 120}" x2="${cx - 220}" y2="${cy + 120}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 225}" y1="${cy - 120}" x2="${cx - 215}" y2="${cy - 120}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 225}" y1="${cy + 120}" x2="${cx - 215}" y2="${cy + 120}" stroke="#000" stroke-width="0.8" />
    ${T(cx - 240, cy, '240', { size: 11, anchor: 'middle', rotate: -90 })}
    <!-- Section view A-A on right -->
    <text x="${cx + 220}" y="${cy - 180}" font-family="Arial" font-size="13" fill="#000">А</text>
    <text x="${cx + 220}" y="${cy + 180}" font-family="Arial" font-size="13" fill="#000">А</text>
    <circle cx="${cx + 100}" cy="${cy}" r="6" fill="none" stroke="#000" stroke-width="1" />
    <line x1="${cx + 94}" y1="${cy}" x2="${cx + 106}" y2="${cy}" stroke="#000" stroke-width="1" />
    <!-- Surface roughness symbol -->
    <polygon points="${cx - 100},${cy - 40} ${cx - 90},${cy - 28} ${cx - 110},${cy - 28}" fill="none" stroke="#000" stroke-width="1" />
    <text x="${cx - 100}" y="${cy - 50}" font-family="Arial" font-size="10" text-anchor="middle" fill="#000">Ra 6,3</text>
  `

  // ===== Technical requirements (top-left) =====
  const ttLines = s.technicalRequirements.map((t, i) =>
    T(60, 200 + i * 22, `${i + 1}. ${t}`, { size: 12 })
  ).join('\n')
  const ttSvg = `
    ${T(60, 170, 'Технические требования', { size: 13, bold: true })}
    ${ttLines}
  `

  // ===== ГОСТ references list (top-right, above title block) =====
  const gostLines = s.gostReferences.map((g, i) =>
    T(1280, 540 + i * 24, g, { size: 12 })
  ).join('\n')
  const gostSvg = `
    ${T(1280, 510, 'Перечень применённых стандартов:', { size: 12, bold: true })}
    ${gostLines}
  `

  // ===== Title block (штамп) =====
  const tb = `
    ${R(tbX, tbY, tbW, tbH, '#fff')}
    <!-- Top revision row -->
    ${R(tbX, tbY, 40, 24, '#fff')}
    ${R(tbX + 40, tbY, 40, 24, '#fff')}
    ${R(tbX + 80, tbY, 70, 24, '#fff')}
    ${R(tbX + 150, tbY, 40, 24, '#fff')}
    ${R(tbX + 190, tbY, 50, 24, '#fff')}
    ${R(tbX + 240, tbY, tbW - 240, 24, '#fff')}
    ${T(tbX + 20, tbY + 16, 'Изм.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 60, tbY + 16, 'Лист', { size: 9, anchor: 'middle' })}
    ${T(tbX + 115, tbY + 16, '№ докум', { size: 9, anchor: 'middle' })}
    ${T(tbX + 170, tbY + 16, 'Подп.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 215, tbY + 16, 'Дата', { size: 9, anchor: 'middle' })}
    ${T(tbX + 280, tbY + 16, s.documentType, { size: 9 })}

    <!-- Left column: role labels -->
    ${R(tbX, tbY + 24, 60, 90, '#fff')}
    ${L(tbX, tbY + 24 + 22, tbX + 60, tbY + 24 + 22)}
    ${L(tbX, tbY + 24 + 44, tbX + 60, tbY + 24 + 44)}
    ${L(tbX, tbY + 24 + 66, tbX + 60, tbY + 24 + 66)}
    ${T(tbX + 30, tbY + 24 + 15, 'Разраб.', { size: 10, anchor: 'middle' })}
    ${T(tbX + 30, tbY + 24 + 37, 'Пров.', { size: 10, anchor: 'middle' })}
    ${T(tbX + 30, tbY + 24 + 59, 'Н.контр.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 30, tbY + 24 + 81, 'Утв.', { size: 10, anchor: 'middle' })}

    <!-- Names column -->
    ${R(tbX + 60, tbY + 24, 130, 90, '#fff')}
    ${L(tbX + 60, tbY + 24 + 22, tbX + 190, tbY + 24 + 22)}
    ${L(tbX + 60, tbY + 24 + 44, tbX + 190, tbY + 24 + 44)}
    ${L(tbX + 60, tbY + 24 + 66, tbX + 190, tbY + 24 + 66)}
    ${T(tbX + 125, tbY + 24 + 15, s.signatures.developed, { size: 11, anchor: 'middle' })}
    ${T(tbX + 125, tbY + 24 + 37, s.signatures.checked, { size: 11, anchor: 'middle' })}
    ${T(tbX + 125, tbY + 24 + 59, s.signatures.normControl, { size: 11, anchor: 'middle' })}
    ${T(tbX + 125, tbY + 24 + 81, s.signatures.approved, { size: 11, anchor: 'middle' })}

    <!-- Subsignature column (Подп.) -->
    ${R(tbX + 190, tbY + 24, 30, 90, '#fff')}
    ${L(tbX + 190, tbY + 24 + 22, tbX + 220, tbY + 24 + 22)}
    ${L(tbX + 190, tbY + 24 + 44, tbX + 220, tbY + 24 + 44)}
    ${L(tbX + 190, tbY + 24 + 66, tbX + 220, tbY + 24 + 66)}
    ${T(tbX + 205, tbY + 16 + 24 + 15, '', { size: 9, anchor: 'middle' })}
    ${T(tbX + 205, tbY + 24 + 37, 'И.И.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 205, tbY + 24 + 59, 'П.П.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 205, tbY + 24 + 81, '', { size: 9, anchor: 'middle' })}
    ${T(tbX + 205, tbY + 24 + 15, 'И.И.', { size: 9, anchor: 'middle' })}

    <!-- Date column -->
    ${R(tbX + 220, tbY + 24, 50, 90, '#fff')}
    ${L(tbX + 220, tbY + 24 + 22, tbX + 270, tbY + 24 + 22)}
    ${L(tbX + 220, tbY + 24 + 44, tbX + 270, tbY + 24 + 44)}
    ${L(tbX + 220, tbY + 24 + 66, tbX + 270, tbY + 24 + 66)}
    ${T(tbX + 245, tbY + 24 + 15, s.dates.developed, { size: 10, anchor: 'middle' })}
    ${T(tbX + 245, tbY + 24 + 37, s.dates.checked, { size: 10, anchor: 'middle' })}
    ${T(tbX + 245, tbY + 24 + 59, '', { size: 10, anchor: 'middle' })}
    ${T(tbX + 245, tbY + 24 + 81, s.dates.approved, { size: 10, anchor: 'middle' })}

    <!-- Right block: Литера | Масса | Масштаб -->
    ${R(tbX + 270, tbY + 24, 60, 90, '#fff')}
    ${L(tbX + 270, tbY + 24 + 30, tbX + 330, tbY + 24 + 30)}
    ${L(tbX + 270, tbY + 24 + 60, tbX + 330, tbY + 24 + 60)}
    ${T(tbX + 300, tbY + 24 + 12, 'Лит.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 300, tbY + 24 + 25, s.letter, { size: 14, bold: true, anchor: 'middle' })}
    ${T(tbX + 300, tbY + 24 + 42, 'Масса', { size: 9, anchor: 'middle' })}
    ${T(tbX + 300, tbY + 24 + 55, s.mass, { size: 11, anchor: 'middle' })}
    ${T(tbX + 300, tbY + 24 + 72, 'Масштаб', { size: 9, anchor: 'middle' })}
    ${T(tbX + 300, tbY + 24 + 85, s.scale, { size: 12, bold: true, anchor: 'middle' })}

    <!-- Stage | Sheet | Sheets -->
    ${R(tbX + 330, tbY + 24, tbW - 330, 90, '#fff')}
    ${L(tbX + 330, tbY + 24 + 30, tbX + tbW, tbY + 24 + 30)}
    ${L(tbX + 330, tbY + 24 + 60, tbX + tbW, tbY + 24 + 60)}
    ${T(tbX + 350, tbY + 24 + 12, 'Стадия', { size: 9, anchor: 'middle' })}
    ${T(tbX + 350, tbY + 24 + 25, s.stage, { size: 13, bold: true, anchor: 'middle' })}
    ${T(tbX + 350, tbY + 24 + 42, 'Лист', { size: 9, anchor: 'middle' })}
    ${T(tbX + 350, tbY + 24 + 55, '1', { size: 13, bold: true, anchor: 'middle' })}
    ${T(tbX + 350, tbY + 24 + 72, 'Листов', { size: 9, anchor: 'middle' })}
    ${T(tbX + 350, tbY + 24 + 85, '1', { size: 13, bold: true, anchor: 'middle' })}

    <!-- Bottom row: name | designation | org -->
    ${R(tbX, tbY + 114, tbW, 57, '#fff')}
    ${L(tbX + 180, tbY + 114, tbX + 180, tbY + 171)}
    ${L(tbX + 330, tbY + 114, tbX + 330, tbY + 171)}
    ${T(tbX + 90, tbY + 132, s.name, { size: 16, bold: true, anchor: 'middle' })}
    ${T(tbX + 90, tbY + 158, '(наименование изделия)', { size: 8, anchor: 'middle' })}
    ${T(tbX + 255, tbY + 138, s.designation, { size: 12, bold: true, anchor: 'middle' })}
    ${T(tbX + 255, tbY + 158, '(обозначение документа)', { size: 8, anchor: 'middle' })}
    ${T(tbX + 380, tbY + 132, 'Северо-Верфь', { size: 10, anchor: 'middle' })}
    ${T(tbX + 380, tbY + 158, '(организация)', { size: 8, anchor: 'middle' })}

    <!-- Format label top-left of title block -->
    ${T(tbX + tbW - 10, tbY - 8, 'Формат ' + s.format, { size: 11, bold: true, anchor: 'end' })}
  `

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" />
  <!-- Outer frame -->
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#000" stroke-width="2.5" />
  <!-- Inner frame -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#000" stroke-width="1" />
  ${drawingSvg}
  ${ttSvg}
  ${gostSvg}
  ${tb}
</svg>`
  return svg
}

// ===== A4 portrait template (Фланец) =====
// Canvas: 1000x1414
function renderA4(s: StampData): string {
  const W = 1000
  const H = 1414
  const tbX = 525
  const tbY = 1218
  const tbW = 435
  const tbH = 156

  const T = (x: number, y: number, text: string, opts: { size?: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rotate?: number } = {}) => {
    const size = opts.size ?? 11
    const anchor = opts.anchor ?? 'start'
    const weight = opts.bold ? 'bold' : 'normal'
    const rot = opts.rotate ? ` transform="rotate(${opts.rotate} ${x} ${y})"` : ''
    return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#000"${rot}>${escapeXml(text)}</text>`
  }
  const L = (x1: number, y1: number, x2: number, y2: number, w = 1) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}" />`
  const R = (x: number, y: number, w: number, h: number, fill = 'none') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#000" stroke-width="1" />`

  // Drawing: top view of a flange (circle with bolt holes)
  const cx = 500
  const cy = 540
  const drawingSvg = `
    <!-- Outer circle -->
    <circle cx="${cx}" cy="${cy}" r="220" fill="none" stroke="#000" stroke-width="2.5" />
    <!-- Inner hole -->
    <circle cx="${cx}" cy="${cy}" r="100" fill="none" stroke="#000" stroke-width="2" />
    <!-- Bolt circle (centerline) -->
    <circle cx="${cx}" cy="${cy}" r="165" fill="none" stroke="#000" stroke-width="0.7" stroke-dasharray="14,3,2,3" />
    <!-- 8 bolt holes -->
    ${Array.from({ length: 8 }).map((_, i) => {
      const a = (i * Math.PI) / 4
      const hx = cx + 165 * Math.cos(a)
      const hy = cy + 165 * Math.sin(a)
      return `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="16" fill="#fff" stroke="#000" stroke-width="1.5" />`
    }).join('\n')}
    <!-- Centerlines -->
    <line x1="${cx - 250}" y1="${cy}" x2="${cx + 250}" y2="${cy}" stroke="#000" stroke-width="0.7" stroke-dasharray="14,3,2,3" />
    <line x1="${cx}" y1="${cy - 250}" x2="${cx}" y2="${cy + 250}" stroke="#000" stroke-width="0.7" stroke-dasharray="14,3,2,3" />
    <!-- Outer diameter dimension -->
    <line x1="${cx - 250}" y1="${cy + 270}" x2="${cx + 250}" y2="${cy + 270}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx - 250}" y1="${cy + 265}" x2="${cx - 250}" y2="${cy + 275}" stroke="#000" stroke-width="0.8" />
    <line x1="${cx + 250}" y1="${cy + 265}" x2="${cx + 250}" y2="${cy + 275}" stroke="#000" stroke-width="0.8" />
    ${T(cx, cy + 290, 'Ø440', { size: 13, bold: true, anchor: 'middle' })}
    <!-- Inner diameter dimension -->
    ${T(cx - 110, cy + 20, 'Ø200', { size: 12, anchor: 'middle' })}
    <!-- Bolt circle dimension -->
    ${T(cx + 90, cy + 130, 'Ø330', { size: 11, anchor: 'middle' })}
    <!-- Roughness symbol -->
    <polygon points="${cx + 240},${cy - 20} ${cx + 250},${cy - 8} ${cx + 230},${cy - 8}" fill="none" stroke="#000" stroke-width="1" />
    <text x="${cx + 240}" y="${cy - 30}" font-family="Arial" font-size="11" text-anchor="middle" fill="#000">Ra 3,2</text>
    <!-- Section view label -->
    <text x="${cx - 270}" y="${cy - 250}" font-family="Arial" font-size="13" fill="#000">А</text>
    <text x="${cx + 260}" y="${cy - 250}" font-family="Arial" font-size="13" fill="#000">А</text>
    <!-- Section A-A (simplified) -->
    <rect x="${cx - 80}" y="${cy + 340}" width="160" height="40" fill="none" stroke="#000" stroke-width="1.5" />
    <line x1="${cx - 80}" y1="${cy + 360}" x2="${cx + 80}" y2="${cy + 360}" stroke="#000" stroke-width="1" stroke-dasharray="6,3,2,3" />
    ${T(cx, cy + 405, 'Сечение А-А', { size: 12, bold: true, anchor: 'middle' })}
  `

  // Technical requirements (below drawing)
  const ttLines = s.technicalRequirements.map((t, i) =>
    T(60, 970 + i * 22, `${i + 1}. ${t}`, { size: 12 })
  ).join('\n')
  const ttSvg = `
    ${T(60, 940, 'Технические требования', { size: 13, bold: true })}
    ${ttLines}
  `

  // ГОСТ references
  const gostLines = s.gostReferences.map((g, i) =>
    T(60, 1110 + i * 22, g, { size: 12 })
  ).join('\n')
  const gostSvg = `
    ${T(60, 1080, 'Перечень применённых стандартов:', { size: 12, bold: true })}
    ${gostLines}
  `

  const tb = `
    ${R(tbX, tbY, tbW, tbH, '#fff')}
    <!-- Top revision row -->
    ${R(tbX, tbY, 35, 22, '#fff')}
    ${R(tbX + 35, tbY, 35, 22, '#fff')}
    ${R(tbX + 70, tbY, 65, 22, '#fff')}
    ${R(tbX + 135, tbY, 35, 22, '#fff')}
    ${R(tbX + 170, tbY, 50, 22, '#fff')}
    ${R(tbX + 220, tbY, tbW - 220, 22, '#fff')}
    ${T(tbX + 17, tbY + 15, 'Изм.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 52, tbY + 15, 'Лист', { size: 9, anchor: 'middle' })}
    ${T(tbX + 102, tbY + 15, '№ докум', { size: 9, anchor: 'middle' })}
    ${T(tbX + 152, tbY + 15, 'Подп.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 195, tbY + 15, 'Дата', { size: 9, anchor: 'middle' })}
    ${T(tbX + 255, tbY + 15, s.documentType, { size: 9 })}

    <!-- Left column: role labels -->
    ${R(tbX, tbY + 22, 55, 80, '#fff')}
    ${L(tbX, tbY + 22 + 20, tbX + 55, tbY + 22 + 20)}
    ${L(tbX, tbY + 22 + 40, tbX + 55, tbY + 22 + 40)}
    ${L(tbX, tbY + 22 + 60, tbX + 55, tbY + 22 + 60)}
    ${T(tbX + 27, tbY + 22 + 14, 'Разраб.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 27, tbY + 22 + 34, 'Пров.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 27, tbY + 22 + 54, 'Н.контр.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 27, tbY + 22 + 74, 'Утв.', { size: 9, anchor: 'middle' })}

    <!-- Names column -->
    ${R(tbX + 55, tbY + 22, 130, 80, '#fff')}
    ${L(tbX + 55, tbY + 22 + 20, tbX + 185, tbY + 22 + 20)}
    ${L(tbX + 55, tbY + 22 + 40, tbX + 185, tbY + 22 + 40)}
    ${L(tbX + 55, tbY + 22 + 60, tbX + 185, tbY + 22 + 60)}
    ${T(tbX + 120, tbY + 22 + 14, s.signatures.developed, { size: 11, anchor: 'middle' })}
    ${T(tbX + 120, tbY + 22 + 34, s.signatures.checked, { size: 11, anchor: 'middle' })}
    ${T(tbX + 120, tbY + 22 + 54, s.signatures.normControl, { size: 11, anchor: 'middle' })}
    ${T(tbX + 120, tbY + 22 + 74, s.signatures.approved, { size: 11, anchor: 'middle' })}

    <!-- Subsignature column -->
    ${R(tbX + 185, tbY + 22, 30, 80, '#fff')}
    ${L(tbX + 185, tbY + 22 + 20, tbX + 215, tbY + 22 + 20)}
    ${L(tbX + 185, tbY + 22 + 40, tbX + 215, tbY + 22 + 40)}
    ${L(tbX + 185, tbY + 22 + 60, tbX + 215, tbY + 22 + 60)}

    <!-- Date column -->
    ${R(tbX + 215, tbY + 22, 45, 80, '#fff')}
    ${L(tbX + 215, tbY + 22 + 20, tbX + 260, tbY + 22 + 20)}
    ${L(tbX + 215, tbY + 22 + 40, tbX + 260, tbY + 22 + 40)}
    ${L(tbX + 215, tbY + 22 + 60, tbX + 260, tbY + 22 + 60)}
    ${T(tbX + 237, tbY + 22 + 14, s.dates.developed, { size: 9, anchor: 'middle' })}
    ${T(tbX + 237, tbY + 22 + 34, s.dates.checked, { size: 9, anchor: 'middle' })}
    ${T(tbX + 237, tbY + 22 + 54, '', { size: 9, anchor: 'middle' })}
    ${T(tbX + 237, tbY + 22 + 74, s.dates.approved, { size: 9, anchor: 'middle' })}

    <!-- Right block: Литера | Масса | Масштаб -->
    ${R(tbX + 260, tbY + 22, 60, 80, '#fff')}
    ${L(tbX + 260, tbY + 22 + 27, tbX + 320, tbY + 22 + 27)}
    ${L(tbX + 260, tbY + 22 + 54, tbX + 320, tbY + 22 + 54)}
    ${T(tbX + 290, tbY + 22 + 10, 'Лит.', { size: 9, anchor: 'middle' })}
    ${T(tbX + 290, tbY + 22 + 22, s.letter, { size: 13, bold: true, anchor: 'middle' })}
    ${T(tbX + 290, tbY + 22 + 38, 'Масса', { size: 9, anchor: 'middle' })}
    ${T(tbX + 290, tbY + 22 + 50, s.mass, { size: 10, anchor: 'middle' })}
    ${T(tbX + 290, tbY + 22 + 64, 'Масштаб', { size: 9, anchor: 'middle' })}
    ${T(tbX + 290, tbY + 22 + 76, s.scale, { size: 12, bold: true, anchor: 'middle' })}

    <!-- Stage | Sheet | Sheets -->
    ${R(tbX + 320, tbY + 22, tbW - 320, 80, '#fff')}
    ${L(tbX + 320, tbY + 22 + 27, tbX + tbW, tbY + 22 + 27)}
    ${L(tbX + 320, tbY + 22 + 54, tbX + tbW, tbY + 22 + 54)}
    ${T(tbX + 378, tbY + 22 + 10, 'Стадия', { size: 9, anchor: 'middle' })}
    ${T(tbX + 378, tbY + 22 + 22, s.stage, { size: 12, bold: true, anchor: 'middle' })}
    ${T(tbX + 378, tbY + 22 + 38, 'Лист', { size: 9, anchor: 'middle' })}
    ${T(tbX + 378, tbY + 22 + 50, '1', { size: 12, bold: true, anchor: 'middle' })}
    ${T(tbX + 378, tbY + 22 + 64, 'Листов', { size: 9, anchor: 'middle' })}
    ${T(tbX + 378, tbY + 22 + 76, '1', { size: 12, bold: true, anchor: 'middle' })}

    <!-- Bottom row: name | designation | org -->
    ${R(tbX, tbY + 102, tbW, 54, '#fff')}
    ${L(tbX + 180, tbY + 102, tbX + 180, tbY + 156)}
    ${L(tbX + 320, tbY + 102, tbX + 320, tbY + 156)}
    ${T(tbX + 90, tbY + 120, s.name, { size: 16, bold: true, anchor: 'middle' })}
    ${T(tbX + 90, tbY + 145, '(наименование изделия)', { size: 8, anchor: 'middle' })}
    ${T(tbX + 250, tbY + 126, s.designation, { size: 12, bold: true, anchor: 'middle' })}
    ${T(tbX + 250, tbY + 145, '(обозначение документа)', { size: 8, anchor: 'middle' })}
    ${T(tbX + 380, tbY + 120, 'Северо-Верфь', { size: 10, anchor: 'middle' })}
    ${T(tbX + 380, tbY + 145, '(организация)', { size: 8, anchor: 'middle' })}

    <!-- Format label -->
    ${T(tbX + tbW - 10, tbY - 8, 'Формат ' + s.format, { size: 11, bold: true, anchor: 'end' })}
  `

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" />
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#000" stroke-width="2.5" />
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#000" stroke-width="1" />
  ${drawingSvg}
  ${ttSvg}
  ${gostSvg}
  ${tb}
</svg>`
  return svg
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // ===== Sample 1: Кронштейн (A3) — INTENTIONAL ERRORS =====
  const sample1: StampData = {
    format: 'A3',
    designation: 'АБВ.301254.001',
    name: 'Кронштейн',
    scale: '1:2',
    mass: '12,5 кг.', // ERROR: extra dot (catches R-MASS-001)
    material: 'Сталь 09Г2С', // ERROR: no ГОСТ (catches R-MAT-002)
    letter: 'О',
    stage: 'РК',
    signatures: {
      developed: 'Иванов И.И.',
      checked: 'Петров П.П.',
      normControl: '', // ERROR: empty (catches R-SIGN-003)
      approved: 'Сидоров С.С.',
    },
    dates: {
      developed: '12.03.2025',
      checked: '14.03.2025',
      approved: '18.03.2025',
    },
    technicalRequirements: [
      'Неуказанные предельные отклонения H14, h14, ±IT14/2.',
      'Острые кромки притупить R0,5 мм.',
      'Покрытие: грунт ГФ-021, ГОСТ 25129-82.',
    ],
    gostReferences: [
      'ГОСТ 2.307-2011 — Нанесение размеров',
      'ГОСТ 2.309-73 — Шероховатость поверхностей',
    ], // ERROR: no ГОСТ 19281 (catches R-MAT-003)
    documentType: 'Чертёж детали',
  }

  // ===== Sample 2: Фланец (A4) — INTENTIONAL ERRORS =====
  const sample2: StampData = {
    format: 'A4',
    designation: 'АБВ.301455.012',
    name: 'Фланец',
    scale: '1:3', // ERROR: non-standard scale (catches R-SCALE-001)
    mass: '5,2 кг',
    material: '', // ERROR: empty material (catches R-MAT-001)
    letter: 'О',
    stage: '', // ERROR: empty stage (catches R-STAGE-001)
    signatures: {
      developed: 'Смирнов А.В.',
      checked: 'Козлов Д.М.',
      normControl: 'Морозов Е.П.',
      approved: '', // ERROR: empty approved (catches R-SIGN-004)
    },
    dates: {
      developed: '05.04.2025',
      checked: '08.04.2025',
      approved: '',
    },
    technicalRequirements: [
      'Неуказанные предельные отклонения H14, h14, ±IT14/2.',
      'Острые кромки притупить.',
      'Отверстия 8 отв. Ø16 H14 выполнить по кондуктору.',
    ],
    gostReferences: [
      'ГОСТ 2.307-2011',
      'ГОСТ 2.309-73',
      'ГОСТ 2.316-2008',
    ],
    documentType: 'Чертёж детали',
  }

  console.log('Rendering sample 1: Кронштейн (A3)...')
  const svg1 = renderA3(sample1)
  await sharp(Buffer.from(svg1)).png().toFile(path.join(OUT_DIR, 'sample-1-kronshtein.png'))
  console.log('  → public/samples/sample-1-kronshtein.png')

  console.log('Rendering sample 2: Фланец (A4)...')
  const svg2 = renderA4(sample2)
  await sharp(Buffer.from(svg2)).png().toFile(path.join(OUT_DIR, 'sample-2-flanets.png'))
  console.log('  → public/samples/sample-2-flanets.png')

  console.log('✅ Done')
}

main().catch((e) => {
  console.error('❌ Failed:', e)
  process.exit(1)
})
