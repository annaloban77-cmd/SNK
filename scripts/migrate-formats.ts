/**
 * Migration: recalculate document.format from 'unknown' (or empty) to a sensible default.
 *
 * Strategy:
 *   - CAD source types (dwg/dxf/cdw/sld-asterisk/spw) -> 'A3' (most common in shipbuilding)
 *   - Scan/PDF/image source types -> infer from image aspect ratio when possible (uses sharp)
 *   - If file missing or unreadable -> 'A3' fallback
 *
 * Idempotent: re-running does not change rows that already have a valid A0-A5 format.
 *
 * Usage: `bun run scripts/migrate-formats.ts`
 */
import { db } from '../src/lib/db'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { resolve } from 'path'

const CAD_SOURCES = new Set(['dwg', 'dxf', 'cdw', 'sldprt', 'sldasm', 'slddrw', 'spw'])

async function detectFromImage(filePath: string): Promise<string | null> {
  try {
    const abs = resolve(filePath)
    if (!existsSync(abs)) return null
    const meta = await sharp(abs).metadata()
    if (!meta.width || !meta.height) return null
    const ratio = meta.width / meta.height
    if (ratio < 0.75) return 'A4' // portrait
    return 'A3'                  // landscape or square (most common in shipbuilding)
  } catch {
    return null
  }
}

async function main() {
  const docs = await db.document.findMany({
    select: { id: true, name: true, format: true, sourceType: true, filePath: true },
  })
  const candidates = docs.filter((d) => !d.format || d.format === 'unknown' || d.format.trim() === '')
  console.log(`[migrate-formats] Found ${candidates.length} of ${docs.length} documents with missing/unknown format`)

  let fixed = 0
  for (const d of candidates) {
    let newFormat: string | null = null

    // 1) CAD source → A3 (most common in shipbuilding; format itself is irrelevant for CAD metadata-only flow)
    if (d.sourceType && CAD_SOURCES.has(d.sourceType)) {
      newFormat = 'A3'
    }
    // 2) Scan/PDF/image → infer from aspect ratio if file exists
    if (!newFormat && d.filePath) {
      newFormat = await detectFromImage(d.filePath)
    }
    // 3) Fallback by source type
    if (!newFormat) {
      newFormat = d.sourceType && CAD_SOURCES.has(d.sourceType) ? 'A3' : 'A4'
    }

    await db.document.update({ where: { id: d.id }, data: { format: newFormat } })
    fixed++
    console.log(`  ✓ ${d.name}: → ${newFormat}`)
  }

  console.log(`[migrate-formats] Done. Updated ${fixed} documents.`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
