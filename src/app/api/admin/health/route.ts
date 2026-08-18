import { NextResponse } from 'next/server'
import os from 'os'

export const dynamic = 'force-dynamic'

// GET /api/admin/health — здоровье системы
export async function GET() {
  const mem = process.memoryUsage()
  const uptime = process.uptime()
  const cpuLoad = os.loadavg()

  return NextResponse.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      used: mem.rss,
      heap: mem.heapUsed,
      external: mem.external,
    },
    cpu: `${cpuLoad[0].toFixed(2)} / ${cpuLoad[1].toFixed(2)} / ${cpuLoad[2].toFixed(2)}`,
    platform: process.platform,
    nodeVersion: process.version,
  })
}
