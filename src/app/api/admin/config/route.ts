import { NextRequest, NextResponse } from 'next/server'
import { getConfig, saveConfig, ConfigValidationError } from '@/lib/config-loader'

export const dynamic = 'force-dynamic'

// GET /api/admin/config — получить текущий конфиг
export async function GET() {
  const config = getConfig()
  return NextResponse.json(config)
}

// PATCH /api/admin/config — обновить конфиг (запись в config.yaml)
// Возвращает 400 при невалидных данных (Zod-валидация).
export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Тело запроса не является валидным JSON.' },
      { status: 400 }
    )
  }
  try {
    const saved = saveConfig(body)
    return NextResponse.json({ success: true, message: 'Конфигурация сохранена. Перезапустите службу для применения.' })
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      return NextResponse.json(
        { error: 'Конфигурация невалидна', issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Не удалось сохранить конфигурацию.', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
