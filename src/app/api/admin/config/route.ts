import { NextRequest, NextResponse } from 'next/server'
import { getConfig, saveConfig } from '@/lib/config-loader'

export const dynamic = 'force-dynamic'

// GET /api/admin/config — получить текущий конфиг
export async function GET() {
  const config = getConfig()
  return NextResponse.json(config)
}

// PATCH /api/admin/config — обновить конфиг (запись в config.yaml)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  saveConfig(body)
  return NextResponse.json({ success: true, message: 'Конфигурация сохранена. Перезапустите службу для применения.' })
}
