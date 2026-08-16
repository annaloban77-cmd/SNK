import { NextRequest, NextResponse } from 'next/server'
import { generateCsvReport } from '@/lib/report-csv'

export const dynamic = 'force-dynamic'

// GET /api/reports/[documentId]/csv — CSV отчёт для Excel
export async function GET(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params
  try {
    const { csv, filename } = await generateCsvReport(documentId)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
