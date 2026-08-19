/**
 * Honest format detector — determines paper format (A0..A4) from real evidence,
 * or returns null when format cannot be determined from available data.
 *
 * Strategy:
 *   - Rasters (PNG/JPG/PDF-raster): aspect ratio with 2% tolerance
 *       A-series ratios (width / height):
 *         A4 portrait:  210/297 = 0.7071   → expected ratio ≈ 0.7071 ± 2%
 *         A4 landscape: 297/210 = 1.4142   → expected ratio ≈ 1.4142 ± 2%
 *         A3 portrait:  297/420 = 0.7071   → SAME as A4 portrait — indistinguishable
 *         A3 landscape: 420/297 = 1.4142   → SAME as A4 landscape — indistinguishable
 *       Without DPI/sheet markers we cannot distinguish A3-portrait from A4-portrait
 *       by aspect ratio alone. We return 'A3' for landscape >1.4 (most common in
 *       shipbuilding) and 'A4' for portrait <0.75, BUT only if the ratio is within
 *       2% of the A-series canonical ratio. Square-ish or odd ratios → null.
 *   - DWG/CDW: format string from CAD header (already extracted by cad-parser).
 *       If header has 'Формат'/'Format' field with valid value → use it.
 *       Otherwise → null.
 *
 * This module is used by:
 *   - src/app/api/_analyze.ts (during analyze pipeline)
 *   - scripts/migrate-formats.ts (one-shot DB migration)
 *
 * Usage: `import { detectFormatHonest } from '@/lib/format-detector'`
 */
import sharp from 'sharp'
import { existsSync } from 'fs'
import { resolve } from 'path'

const A_SERIES_RATIO = 1.4142 // √2 — canonical ratio of A-series paper (long/short side)
const TOLERANCE = 0.02 // 2% tolerance

/**
 * Returns true if `ratio` is within `TOLERANCE` (2%) of `target`.
 */
function isWithinTolerance(ratio: number, target: number): boolean {
  return Math.abs(ratio - target) / target <= TOLERANCE
}

/**
 * Detect paper format from a raster image (PNG/JPG/PDF-raster).
 * Returns 'A3' | 'A4' | null.
 *
 * - A4 portrait:  ratio ≈ 1/√2 = 0.7071  (within 2% → 0.6930..0.7212)
 * - A4 landscape: ratio ≈ √2   = 1.4142  (within 2% → 1.3859..1.4425)
 * - A3 portrait:  same ratio as A4 portrait — indistinguishable
 * - A3 landscape: same ratio as A4 landscape — indistinguishable
 *
 * Convention: shipbuilding default for landscape = A3 (most common), portrait = A4.
 * BUT if the ratio is outside both tolerance bands (square-ish, A0, etc.), we
 * return null rather than guessing.
 */
export async function detectFormatFromImage(
  filePath: string
): Promise<'A0' | 'A1' | 'A2' | 'A3' | 'A4' | null> {
  try {
    const abs = resolve(filePath)
    if (!existsSync(abs)) return null
    const meta = await sharp(abs).metadata()
    if (!meta.width || !meta.height) return null
    const ratio = meta.width / meta.height

    // Landscape: ratio ≈ √2
    if (isWithinTolerance(ratio, A_SERIES_RATIO)) {
      // A3 landscape is the most common in shipbuilding; we cannot distinguish
      // from A4 landscape by aspect ratio alone.
      // If width > 1100 px at typical scan DPIs (~150-300), it's likely A3; else A4.
      // This is a heuristic, not a guarantee.
      return meta.width >= 1100 ? 'A3' : 'A4'
    }
    // Portrait: ratio ≈ 1/√2
    if (isWithinTolerance(ratio, 1 / A_SERIES_RATIO)) {
      // A4 portrait is most common for text documents; A3 portrait is rare in shipbuilding.
      // Heuristic: if height > 1500 px at typical scan DPIs, it's likely A3; else A4.
      return meta.height >= 1500 ? 'A3' : 'A4'
    }
    // Square-ish or other ratios → cannot determine honestly
    return null
  } catch {
    return null
  }
}

/**
 * Detect format from CAD stamp attributes (already extracted by cad-parser).
 * Returns the format string if it's a valid A0–A4, else null.
 *
 * CAD files sometimes have a 'format' attribute in their title block.
 * If it's missing or contains garbage, we return null — we do NOT guess.
 */
export function detectFormatFromCadStamp(
  stampAttributes: Record<string, string> | undefined
): 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | null {
  if (!stampAttributes) return null
  const raw = stampAttributes.format
  if (!raw || typeof raw !== 'string') return null
  const f = raw.trim().toUpperCase()
  const valid: Array<'A0' | 'A1' | 'A2' | 'A3' | 'A4'> = ['A0', 'A1', 'A2', 'A3', 'A4']
  return valid.includes(f as 'A0') ? (f as 'A0' | 'A1' | 'A2' | 'A3' | 'A4') : null
}

/**
 * Convenience: detect format from a CAD-parsed file (uses both stamp attributes
 * and would be extended to read layout/header for sheet dimensions).
 */
export function detectFormatFromCad(parsed: {
  stampAttributes?: Record<string, string>
  format?: string
}): 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | null {
  // 1. Try stamp attributes first
  const fromStamp = detectFormatFromCadStamp(parsed.stampAttributes)
  if (fromStamp) return fromStamp

  // 2. Try parsed.format (e.g., 'A4' literal in DXF text entities)
  if (parsed.format && typeof parsed.format === 'string') {
    const f = parsed.format.trim().toUpperCase()
    const valid: Array<'A0' | 'A1' | 'A2' | 'A3' | 'A4'> = ['A0', 'A1', 'A2', 'A3', 'A4']
    if (valid.includes(f as 'A0')) return f as 'A0' | 'A1' | 'A2' | 'A3' | 'A4'
  }

  return null
}
