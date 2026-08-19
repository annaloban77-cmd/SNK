import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/guide — список томов руководства
export async function GET() {
  const tomes = [
    { slug: 'designer', title: 'Конструктору' },
    { slug: 'normo', title: 'Нормоконтролёру' },
    { slug: 'admin', title: 'Администратору' },
    { slug: 'tech', title: 'Техническое' },
  ]
  return NextResponse.json({ items: tomes })
}
