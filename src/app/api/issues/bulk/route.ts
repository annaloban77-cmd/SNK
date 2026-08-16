import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ACTION_TO_STATUS: Record<string, string> = {
  confirm: 'confirmed',
  reject: 'rejected',
  fix: 'fixed',
}

export async function POST(req: NextRequest) {
  let body: { ids?: string[]; action?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids должен быть непустым массивом' }, { status: 400 })
  }
  const action = body.action || ''
  const status = ACTION_TO_STATUS[action]
  if (!status) {
    return NextResponse.json({ error: `Недопустимое действие: ${action}. Допустимо: confirm, reject, fix` }, { status: 400 })
  }

  const result = await db.issue.updateMany({
    where: { id: { in: body.ids } },
    data: { status },
  })

  return NextResponse.json({ updated: result.count })
}
