import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

// Static manifest of known samples — pairs with the script-generated files.
// Used so the API returns metadata even before the directory is scanned.
const SAMPLES_MANIFEST = [
  {
    id: 'sample-1-kronshtein',
    title: 'Кронштейн (А3, с ошибками)',
    description:
      'Чертёж детали «Кронштейн», формат A3, обозначение АБВ.301254.001. Содержит намеренные ошибки: лишняя точка в массе, материал без ГОСТ, ГОСТ 19281 отсутствует в перечне, нет подписи нормоконтролера.',
    file: 'sample-1-kronshtein.png',
  },
  {
    id: 'sample-2-flanets',
    title: 'Фланец (А4, с ошибками)',
    description:
      'Чертёж детали «Фланец», формат A4, обозначение АБВ.301455.012. Содержит намеренные ошибки: материал не указан, стадия не указана, нет подписи утверждающего, нестандартный масштаб 1:3.',
    file: 'sample-2-flanets.png',
  },
]

export async function GET() {
  const samplesDir = path.join(process.cwd(), 'public', 'samples')
  let filesOnDisk: string[] = []
  if (existsSync(samplesDir)) {
    try {
      const all = await readdir(samplesDir)
      filesOnDisk = all.filter((f) => f.toLowerCase().endsWith('.png'))
    } catch {
      filesOnDisk = []
    }
  }

  const items = SAMPLES_MANIFEST.map((s) => {
    const url = `/samples/${s.file}`
    const exists = filesOnDisk.includes(s.file)
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      url,
      available: exists,
    }
  })

  return NextResponse.json({ items })
}
