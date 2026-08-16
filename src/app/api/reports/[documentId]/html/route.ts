import { NextRequest, NextResponse } from 'next/server'
import { generateHtmlReport } from '@/lib/report-pdf'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  const result = await generateHtmlReport(documentId)
  if (!result) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }
  // RFC 5987 encoded filename (the only ASCII-safe way to embed Cyrillic names)
  const encodedFilename = encodeURIComponent(result.filename)
  // ASCII-only fallback name
  const asciiFallback = 'nk-report.html'
  return new Response(result.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
