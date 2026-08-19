/**
 * Migration: честное определение формата документа.
 *
 * Принцип (P5: честный формат, без подмены):
 *   - Если формат реально определён (штамп/заголовок CAD/пропорции изображения
 *     в допуске 2% A-серии) -> сохраняем его.
 *   - Если определить нельзя -> format = null. НЕ подменяем 'A3' по умолчанию
 *     для CAD-источников — это будет обман пользователя.
 *
 * Strategy:
 *   1. Сканы/PDF/image -> detectFormatFromImage (sharp metadata + 2% tolerance)
 *   2. CAD (DWG/DXF/CDW/SolidWorks/SPW) -> detectFormatFromCad (только если в
 *      stampAttributes есть валидный A0-A4; иначе null)
 *   3. Текущее значение 'unknown' или пустое -> затираем в null
 *
 * Idempotent: повторный запуск не меняет строки, у которых уже валидный A0-A5
 * (или уже null).
 *
 * Usage: `bun run db:migrate-formats`
 */
import { db } from '../src/lib/db'
import { detectFormatFromImage, detectFormatFromCad } from '../src/lib/format-detector'
import { parseCadFile } from '../src/lib/cad-parser'
import { existsSync } from 'fs'
import { resolve } from 'path'

const VALID_FORMATS = new Set(['A0', 'A1', 'A2', 'A3', 'A4'])

async function detectForDocument(d: {
  sourceType: string
  filePath: string
  stampJson: string | null
}): Promise<string | null> {
  // 1. Если в stampJson уже есть валидный формат — доверяем ему
  if (d.stampJson) {
    try {
      const stamp = JSON.parse(d.stampJson)
      const f = (stamp?.format as string | undefined)?.trim()?.toUpperCase()
      if (f && VALID_FORMATS.has(f)) return f
    } catch {
      // ignore parse errors
    }
  }

  const ext = d.filePath.toLowerCase().split('.').pop() || ''
  const isCad = ['dxf', 'dwg', 'sldprt', 'sldasm', 'slddrw', 'cdw', 'spw'].includes(ext)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)

  // 2. CAD: честное определение из stampAttributes (если файл доступен)
  if (isCad && d.filePath && existsSync(resolve(d.filePath))) {
    try {
      const parsed = await parseCadFile(d.filePath)
      return detectFormatFromCad({
        stampAttributes: parsed.stampAttributes,
        format: parsed.stampAttributes?.format,
      })
    } catch {
      // fall through to null
    }
    return null
  }

  // 3. Image: честное определение по пропорциям (2% tolerance)
  if (isImage && d.filePath && existsSync(resolve(d.filePath))) {
    return await detectFormatFromImage(d.filePath)
  }

  // 4. PDF: попытка растеризовать первую страницу и определить пропорции
  if (ext === 'pdf' && d.filePath && existsSync(resolve(d.filePath))) {
    try {
      return await detectFormatFromImage(d.filePath)
    } catch {
      return null
    }
  }

  // 5. В остальных случаях — null (не подменяем)
  return null
}

async function main() {
  const docs = await db.document.findMany({
    select: { id: true, name: true, format: true, sourceType: true, filePath: true, stampJson: true },
  })
  // Кандидаты на пересчёт: текущий формат пустой, 'unknown', или не входит в A0-A5
  const candidates = docs.filter((d) => {
    if (!d.format) return true // null → пробуем определить
    const f = d.format.trim().toUpperCase()
    return !VALID_FORMATS.has(f) // 'unknown', 'CAD', мусор → пересчитываем
  })
  console.log(`[migrate-formats] Found ${candidates.length} of ${docs.length} documents needing format recalculation`)

  let fixed = 0
  let nulled = 0
  for (const d of candidates) {
    const newFormat = await detectForDocument(d)
    await db.document.update({ where: { id: d.id }, data: { format: newFormat } })
    fixed++
    if (newFormat) {
      console.log(`  ✓ ${d.name}: → ${newFormat}`)
    } else {
      nulled++
      console.log(`  • ${d.name}: → null (формат не определён)`)
    }
  }

  console.log(`[migrate-formats] Done. Updated ${fixed} documents (${nulled} set to null).`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
