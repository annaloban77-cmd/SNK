import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

// GET /api/guide — список разделов руководства
export async function GET() {
  const guides = [
    { slug: '01-quick-start', title: 'Быстрый старт (5 минут)' },
    { slug: '02-upload', title: 'Загрузка документов' },
    { slug: '03-results', title: 'Просмотр результатов' },
    { slug: '04-issues', title: 'Работа с замечаниями' },
    { slug: '05-projects', title: 'Проекты' },
    { slug: '06-rules', title: 'Правила' },
    { slug: '07-knowledge', title: 'База знаний' },
    { slug: '08-tests', title: 'Тесты (стенд)' },
    { slug: '09-api-keys', title: 'API-ключи' },
    { slug: '10-roles', title: 'Роли и права' },
    { slug: '11-glossary', title: 'Глоссарий' },
  ]
  return NextResponse.json({ items: guides })
}
