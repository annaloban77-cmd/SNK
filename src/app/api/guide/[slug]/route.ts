import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

// GET /api/guide/[slug] — содержимое раздела руководства (markdown)
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guidePath = path.join(process.cwd(), 'docs', 'guide', `${slug}.md`)
  try {
    const content = await readFile(guidePath, 'utf-8')
    return NextResponse.json({ slug, content })
  } catch {
    return NextResponse.json({ error: 'Раздел не найден' }, { status: 404 })
  }
}
