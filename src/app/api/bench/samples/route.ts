import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/bench/samples — список всех семплов
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '100')
  
  const where = category && category !== 'all' ? { category, isActive: true } : { isActive: true }
  const samples = await db.benchSample.findMany({
    where,
    orderBy: { code: 'asc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  const total = await db.benchSample.count({ where })
  return NextResponse.json({
    items: samples.map(s => ({
      id: s.id, code: s.code, title: s.title, category: s.category,
      documentType: s.documentType, format: s.format, sourceType: s.sourceType,
      filePath: s.filePath,
      expectedCount: s.expectedCount, expectedHigh: s.expectedHigh,
      expectedMedium: s.expectedMedium, expectedLow: s.expectedLow,
      expectedCategories: s.expectedCategories ? JSON.parse(s.expectedCategories) : [],
      description: s.description,
    })),
    total, page, pageSize,
  })
}
