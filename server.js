// server.js — custom Next.js server с двумя HTTP-слушателями
// Порт 1111: основной сайт нормоконтролёра (все роуты КРОМЕ /admin)
// Порт 3333: инженерная консоль (ТОЛЬКО /admin и /api/admin)
// Порты из config.yaml или env
//
// Безопасность (v1.2):
//   - Порт 3333 принимает только /admin и /api/admin запросы
//   - Ролевая защита реализована в src/middleware.ts (cookie nk-role):
//     /admin/* → admin only, /api/admin/* → admin only
//   - Для production используйте reverse proxy (Caddyfile) с SSL

/* eslint-disable @typescript-eslint/no-require-imports */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// Дефолты прямо здесь (config-loader недоступен в CJS)
const PORT_MAIN = parseInt(process.env.PORT_MAIN || '1111')
const PORT_ADMIN = parseInt(process.env.PORT_ADMIN || '3333')
const HOST = process.env.HOST || '0.0.0.0'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // === Порт 1111: основной сайт (все роуты кроме /admin) ===
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    const pathname = parsedUrl.pathname || ''

    // /admin и /api/admin — только на порту 3333
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('403 — Админ-консоль доступна на порту ' + PORT_ADMIN)
      return
    }

    handle(req, res, parsedUrl)
  }).listen(PORT_MAIN, HOST, () => {
    console.log(`\n┌─────────────────────────────────────────────────┐`)
    console.log(`│  НК-Контроль — основной сайт                   │`)
    console.log(`│  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT_MAIN}                  │`)
    console.log(`└─────────────────────────────────────────────────┘`)
  })

  // === Порт 3333: инженерная консоль (только /admin) ===
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    const pathname = parsedUrl.pathname || ''

    // Только /admin и /api/admin на этом порту
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
      // Редирект на /admin
      res.writeHead(302, { Location: '/admin' })
      res.end()
      return
    }

    handle(req, res, parsedUrl)
  }).listen(PORT_ADMIN, HOST, () => {
    console.log(`┌─────────────────────────────────────────────────┐`)
    console.log(`│  НК-Контроль — инженерная консоль («матрица»)   │`)
    console.log(`│  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT_ADMIN}                  │`)
    console.log(`└─────────────────────────────────────────────────┘`)
    console.log('')
  })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
