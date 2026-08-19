# НК-Контроль — Система нормативного контроля для судостроения

Веб-приложение «помощник нормоконтролёра» для судостроительного предприятия.
Принимает сканы и CAD-файлы, извлекает поля основной надписи (штампа по ГОСТ 2.104),
проверяет документ по детерминированным правилам и нормам ГОСТ, формирует объяснимые
замечания со ссылкой на конкретный пункт стандарта. Архитектура построена на семи
принципах P1–P7 (знания в данных, ядро стабильно, стенд как предохранитель релиза).

Стек: **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · z-ai-web-dev-sdk · PaddleOCR sidecar**.

Единственная видимая пользователем страница — `/` (`src/app/page.tsx`).
Все остальные данные доступны через REST API `/api/*`, инженерная консоль — `/admin/*` на отдельном порту.

---

## Назначение

- **Загрузка сканов и CAD**: PDF / PNG / JPG / DXF / DWG / CDW / SLDPRT / SLDASM / SLDDRW / SPW
- **OCR штампа**: цепочка SVG → PaddleOCR → Tesseract → VLM (last-resort)
- **Парсинг CAD**: ATTDEF-блоки в DXF, метаданные DWG/SolidWorks/КОМПАС, текстовые entity
- **Проверка по правилам ГОСТ**: 460 правил (детерминированные + семантические + vision)
- **Замечания с трассировкой**: каждое замечание ссылается на правило → ГОСТ-пункт → поле штампа → координаты (мм)
- **Стенд тестирования**: 3 тира семплов (synthetic, dxf, realistic) с release-gate
- **Multi-tenant**: каждое конструкторское бюро изолировано по `organizationId`

---

## Принципы P1–P7

Из `docs/guide/tech.md` — архитектурный фундамент системы:

| Принцип | Суть | Где реализовано |
|---|---|---|
| **P1** | Знания — в данных (БД), не в весах модели | `prisma/schema.prisma`: Standard, Rule, StandardClause, 8 справочников |
| **P2** | Ядро стабильно, знания обновляются часто | `src/lib/rules.ts` (ядро 18 правил) + `scripts/db-sync.ts` (460 правил в БД) |
| **P3** | Каждое бюро = свой профиль | `Organization` + `organizationId` на Document, BenchSample, BenchRun, ApiKey |
| **P4** | Стенд — предохранитель релиза | `src/lib/bench.ts`: `runReleaseGate()` GREEN только если все 3 тира проходят |
| **P5** | Детерминированность по умолчанию, LLM — только семантика | `src/lib/ocr/stamp-ocr.ts` (VLM только при conf < 0.4), `src/lib/format-detector.ts` (null вместо угадывания) |
| **P6** | Каждое замечание объяснимо (ссылка на ГОСТ) | `Rule.gostRef`, `Issue.gostRef`, `RuleCheckResult.requirement` |
| **P7** | Человек принимает решение | `Issue.status` (new/confirmed/rejected/fixed), `KnowledgeSuggestion` feedback loop |

---

## Архитектура

### Слои

| Слой | Назначение | Файлы |
|---|---|---|
| **core** | Next.js API routes (`/api/*`), страница `/` | `src/app/api/**`, `src/app/page.tsx` |
| **knowledge** | Prisma-модели знаний (стандарты, правила, пункты, справочники) | `prisma/schema.prisma` |
| **rules** | Детерминированный движок правил + адаптеры LLM | `src/lib/rules.ts`, `src/lib/zai.ts` |
| **profiles** | Multi-tenant: Organization, User, ApiKey, AuditLog, Subscription | `prisma/schema.prisma` (блок MONETIZATION) |
| **bench** | Стенд: семплы, прогоны, метрики, release-gate | `src/lib/bench.ts`, `BenchSample/BenchRun/BenchFinding` |

### Поток данных

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Скан /  │     │   CAD    │     │   SVG    │
│  PDF/PNG │     │  DXF/DWG │     │ (бенч)   │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     ▼                ▼                ▼
┌─────────────────────────────────────────────┐
│            OCR / CAD-парсер                 │
│  SVG → PaddleOCR → Tesseract → VLM (last)  │  ← src/lib/ocr/stamp-ocr.ts
└──────────────────┬──────────────────────────┘
                   │ извлечённый штамп
                   ▼
┌─────────────────────────────────────────────┐
│         Движок правил (460 в БД)             │  ← src/lib/rules.ts
│  deterministic + semantic + vision          │
└──────────────────┬──────────────────────────┘
                   │ findings
                   ▼
┌─────────────────────────────────────────────┐
│           Post-filter                       │  ← src/lib/post-filter.ts
│  confidence-aware, dedupe, drop-low         │
└──────────────────┬──────────────────────────┘
                   │ отфильтрованные findings
                   ▼
┌─────────────────────────────────────────────┐
│         LLM-семантика (опционально)         │  ← src/lib/zai.ts (glm-4.6)
│  противоречия, гипотезы с evidence          │
└──────────────────┬──────────────────────────┘
                   │ итоговые findings
                   ▼
┌─────────────────────────────────────────────┐
│   Замечания → Feedback loop → Стенд (P4)    │  ← Issue, KnowledgeSuggestion
└─────────────────────────────────────────────┘
```

### Порты

| Порт | Назначение | Маршруты |
|---|---|---|
| **1111** | Основной сайт нормоконтролёра | все, КРОМЕ `/admin` и `/api/admin` (`server.js`) |
| **3333** | Инженерная консоль («матрица») | ТОЛЬКО `/admin` и `/api/admin` |
| **8100** | PaddleOCR sidecar (OCR-движок) | `http://localhost:8100` (localhost only) |

Порты и хост задаются в `config.yaml` → `server.port_main` / `port_admin` / `host`.

---

## Безопасность

- **`src/middleware.ts` — ролевая защита на Edge-runtime**:
  - `/admin/*` и `/api/admin/*` → admin only
  - `/api/organization/api-keys` (write), `/api/organization/users` (write), `/api/organization/audit` → admin only
  - `/api/rules POST/PATCH/DELETE`, `/api/bench/run POST`, `/api/suggestions/[id]/approve` → admin + normocontroller
  - viewer на любом `POST/PATCH/DELETE` в `/api/*` → 403
  - Роль читается из cookie `nk-role` или заголовка `x-nk-role`
- **Zod-валидация конфигурации** (`src/lib/config-loader.ts`): все поля проверяются при `saveConfig()`, невалидный конфиг отклоняется с понятной ошибкой `ConfigValidationError`
- **Атомарная запись конфига**: пишем в `config.yaml.tmp`, затем `rename` — нет частичных файлов при crash
- **Защита от OOM**:
  - лимит размера загрузки: `uploads.max_size_mb` (50 МБ по умолчанию)
  - лимит строк DXF в `src/lib/cad-parser.ts` (защита от больших файлов)
  - ротация воркеров Tesseract: `terminateOcr()` + `terminateZoneOcr()` после каждого прогона бенча
  - таймаут 30 с на вызовы VLM (`Promise.race` в `stamp-ocr.ts`)
- **Multi-tenant изоляция**: `organizationId` на `Document`, `BenchSample`, `BenchRun`, `ApiKey`, `AuditLog`, `KnowledgeSuggestion`
- **Аудит**: каждое действие администратора пишется в `AuditLog` (action, resourceType, resourceId, ipAddress, userAgent)
- **API-ключи**: `ApiKey.keyHash` (хэш полного ключа) + `keyPrefix` для отображения + `scopes` (read/write/admin) + `requestsLimit` в месяц

---

## База данных

SQLite, файл `db/custom.db` (путь в `config.yaml` → `database.path`).
26 моделей в `prisma/schema.prisma`.

### Ключевые модели

| Модель | Назначение | Кол-во записей |
|---|---|---|
| `Organization` | Мульти-тенант (профили бюро) | 1 |
| `User` | Пользователи с ролями (admin/normocontroller/engineer/viewer) | 4 |
| `ApiKey` | API-ключи с scopes и лимитами | 4 |
| `AuditLog` | Журнал действий (compliance) | 13+ |
| `Document` | Загруженные документы | 12+ |
| `Issue` | Замечания с трассировкой до правила и ГОСТ | 25+ |
| `CheckLog` | Журнал стадий проверки (upload, vlm_extract, rules_check, llm_semantic, report) | growing |
| `Rule` | Правила нормоконтроля (460 в БД, 18 ядерных в `rules.ts`) | **460** |
| `Standard` | ГОСТ / ОСТ / СТО / РД / Регистр | **573** |
| `StandardClause` | Пункты стандартов (для RAG/LLM-проверок) | 30 стандартов с пунктами |
| `Material` | Справочник материалов | 221 |
| `Fastener` | Крепёж (bolt/nut/washer/screw/stud) | 2 730 |
| `Bearing` | Подшипники | 120 |
| `RolledProduct` | Прокат (sheet/bar/angle/channel/beam/pipe) | 243 |
| `WeldingMaterial` | Сварочные материалы (electrode/wire/flux) | 169 |
| `Coating` | Покрытия (primer/enamel/putty/powder) | 160 |
| `PipeFitting` | Трубопроводная арматура | 468 |
| `ShipEquipment` | Судовое оборудование | 292 |
| **Справочников всего** | | **4 403** |
| `BenchSample` | Тестовые документы (synthetic/dxf/realistic/torture/real) | 150 |
| `BenchRun` | Прогоны тестов | 38+ |
| `BenchFinding` | Результаты тестов (matched/false_positive/false_negative) | growing |
| `KnowledgeSuggestion` | Feedback loop (bench_sample/new_rule/reference_entry) | growing |
| `Subscription` | Подписка/биллинг (для будущих платёжных систем) | 0 |
| `Meta` | singleton: `sync_version` БД | 1 |
| `DocType` | Справочник типов документов | 6 |
| `Project` | Проект/комплект документации | — |

### Связи

```
Organization ─┬─ User
              ├─ ApiKey
              ├─ AuditLog ─── User
              ├─ Document ─┬─ Issue ─── Rule ─── Standard ─── StandardClause
              │             ├─ CheckLog                          ↑
              │             └─ DocType                     (onDelete:Cascade)
              ├─ BenchSample ─ BenchFinding
              ├─ BenchRun ──── BenchFinding
              └─ KnowledgeSuggestion ── Issue
Subscription ─── Organization (1:1)
```

---

## Механизмы качества

### Три тира тестов (`src/lib/bench.ts`)

| Тир | Что тестирует | Источник | Статус |
|---|---|---|---|
| **synthetic** | SVG-чертежи с известными ошибками (100% точно) | `scripts/generate-bench-samples.ts` | 🟢 GREEN |
| **dxf** | CAD-файлы (ATTDEF + TEXT entities) | `scripts/generate-dxf-samples.ts` | 🟢 GREEN |
| **realistic** | Сканы с деградацией (поворот, шум) | `scripts/generate-realistic-samples.ts` | 🟡 требует PaddleOCR с 8+ ГБ RAM |

### Релизный гейт (P4)

`runReleaseGate()` прогоняет все 3 тира. **GREEN** только если **все 3 тира GREEN**:

| Статус | Условие |
|---|---|
| `green` | `recallHigh ≥ 0.9` AND `precision ≥ 0.85` AND `passRate ≥ 0.9` |
| `yellow` | `recallHigh ≥ 0.7` AND `precision ≥ 0.6` |
| `red` | остальное |

Порог прохождения одного семпла: `recall ≥ 0.85 AND precision ≥ 0.85` (для `with_errors`); `falsePositives === 0` (для `correct`).

### `db:sync` — идемпотентное заполнение БД

```bash
bun run db:sync
```

Единая команда заполняет: стандарты (573), правила (460), справочники (4 403), тестовые семплы (150).
Версия хранится в `Meta.sync_version` — повторный запуск не дублирует данные.

### Watchdog (защита от зависших прогонов)

- `src/app/api/bench/run/route.ts`: `BENCH_WATCHDOG_MS = 10 * 60 * 1000` (10 минут) — висящий прогон `BenchRun.status='running'` помечается `aborted` с `notes='Превышено время ожидания (10 мин) — watchdog'`
- `src/app/api/documents/route.ts`: висящие `Document.status='processing'` помечаются `failed` со стадией `watchdog`

### Координатная точность

- Допуск 5 мм при матче найденных и ожидаемых ошибок (`COORD_TOLERANCE_MM = 5.0` в `bench.ts`)
- Координаты полей штампа берутся из bounding boxes PaddleOCR (если есть), иначе из статического маппинга по ГОСТ 2.104 (`getRuleCoords()`)
- `coordAccuracy` — среднее отклонение в мм по всем matched парам

---

## Развёртывание

### Docker (рекомендуется)

```bash
docker compose up -d
# Основной сайт:   http://localhost:1111
# Админ-консоль:   http://localhost:3333
# PaddleOCR:       http://localhost:8100 (внутренний)
```

`docker-compose.yml` поднимает два сервиса: `app` (Next.js) и `ocr-service` (PaddleOCR sidecar на 8100).
Volume `paddle_cache` кэширует модели OCR.

### Ручная установка

```bash
# 1. Установить зависимости
bun install

# 2. Создать/обновить схему БД (SQLite)
bun run db:push

# 3. Идемпотентно заполнить БД (стандарты, правила, справочники, тесты)
bun run db:sync

# 4. Заполнить пункты стандартов (RAG для LLM)
bun run db:seed-clauses

# 5. Связать правила со стандартами (Rule.standardId)
bun run db:link

# 6. Запустить сервер (оба порта 1111 + 3333)
bun server.js
```

### Конфигурация

`config.yaml` — единый файл конфигурации (см. `src/lib/config-loader.ts`):

```yaml
server:
  port_main: 1111
  port_admin: 3333
  host: "0.0.0.0"
database:
  type: sqlite
  path: "db/custom.db"
ocr:
  engine: "paddleocr"
  paddleocr_url: "http://localhost:8100"
  confidence_cutoff: 0.4   # ниже — fallback на VLM
  dpi_target: 300
  zone_crop: true
models:
  llm_mode: "cloud_vlm"   # cloud_vlm | local_ollama | off
  vlm_model: "glm-4.5v"
  llm_model: "glm-4.6"
  local_only: false       # true = запрет облачных VLM (СБ верфи)
bench:
  release_gate: true
rules:
  industry_module: "shipbuilding"
uploads:
  max_size_mb: 50
```

Админ-консоль (`/admin` на порту 3333) пишет в этот файл через `saveConfig()` с Zod-валидацией и атомарной записью.

### Требования к железу

| Параметр | Минимум | Рекомендуется |
|---|---|---|
| **RAM** | 4 ГБ (sandbox: realistic тир RED из-за OOM PaddleOCR) | 8–16 ГБ |
| **CPU** | 4 ядра | 8 ядер |
| **Диск** | 20 ГБ (SQLite + uploads + bench samples) | 50 ГБ SSD |
| **GPU** | не требуется | опционально (PaddleOCR в 3–5 раз быстрее на GPU) |
| **ОС** | Linux / macOS / Windows (WSL) | Linux (Docker) |

---

## Как расширять

### Добавить новое правило

1. **Через код**: добавить объект в массив `DETERMINISTIC_RULES` в `src/lib/rules.ts` (см. `mkIssue` для структуры):
   ```ts
   {
     code: 'R-XXX-001',
     title: 'Название правила',
     description: 'Описание',
     severity: 'medium',
     gostRef: 'ГОСТ 2.104-2006, п. X',
     field: 'Имя поля',
     check: (s) => {
       if (/* условие нарушения */) {
         return mkIssue('R-XXX-001', '...', '...', 'medium', 'Поле', 'Рекомендация', 'ГОСТ ...', s.fieldValue)
       }
       return null
     },
   }
   ```
2. **Через UI**: раздел «Правила» → «Создать правило» (нужна роль `admin` или `normocontroller`).
3. Запустить `bun run db:sync` (идемпотентно обновит БД).

### Добавить новый справочник

1. Создать модель в `prisma/schema.prisma` (по образцу `Material`, `Fastener`, ...).
2. `bun run db:push` — применить схему.
3. Создать генератор в `scripts/generate-reference.ts`.
4. Зарегистрировать в `scripts/db-sync.ts`.
5. `bun run db:sync`.

### Добавить новый OCR-движок

1. Реализовать sidecar (FastAPI + модель, порт отличный от 8100).
2. Добавить клиент в `src/lib/ocr/` (по образцу `paddle-ocr.ts`).
3. Вставить в цепочку в `src/lib/ocr/stamp-ocr.ts` — `extractStamp()` (между SVG и Tesseract или после PaddleOCR).

### Добавить новую отрасль

1. Добавить стандарты через скрипт сидинга в `scripts/`.
2. Добавить отраслевые правила (`Rule.category: 'shipbuilding' | 'machinery' | ...`).
3. Указать `industry_module` в `config.yaml`.
4. `bun run db:sync`.

---

## Скрипты

Из `package.json`:

| Скрипт | Что делает |
|---|---|
| `bun run dev` | Запуск Next.js dev на порту 3000 (только основной сайт, без admin-порта) |
| `bun run dev:dual` | Запуск `server.js` — оба порта 1111 + 3333 |
| `bun run build` | `next build` + копирование `static` и `public` в `.next/standalone/` |
| `bun run start` | Production-сервер: `bun .next/standalone/server.js` |
| `bun run lint` | ESLint проверка качества кода |
| `bun run db:push` | `prisma db push` — синхронизация схемы Prisma с SQLite (с `--accept-data-loss`) |
| `bun run db:generate` | `prisma generate` — генерация TypeScript-клиента |
| `bun run db:migrate` | `prisma migrate dev` — создать миграцию |
| `bun run db:reset` | `prisma migrate reset` — сброс БД |
| `bun run db:sync` | `scripts/db-sync.ts` — идемпотентное заполнение БД (стандарты, правила, справочники, тесты) |
| `bun run db:migrate-formats` | `scripts/migrate-formats.ts` — one-shot миграция форматов через `format-detector.ts` |
| `bun run db:seed-clauses` | `scripts/seed-clauses.ts` — наполнение `StandardClause` (пункты стандартов) |
| `bun run db:link` | `scripts/db-link.ts` — связывание `Rule.standardId` со стандартами |

Дополнительные генераторы в `scripts/` (не в npm-скриптах):
`generate-bench-samples.ts`, `generate-dxf-samples.ts`, `generate-realistic-samples.ts`,
`generate-degraded-samples.ts`, `generate-reference.ts`, `seed-comprehensive.ts`,
`seed-block2-rules.ts`, `seed-more-rules-standards.ts`.

---

## История решений

- **Почему VLM не primary (P5)** — VLM (glm-4.5v) нестабилен, галлюцинирует поля и стоит дороже.
  Используется только как last-resort при `confidence < 0.4` после SVG / PaddleOCR / Tesseract
  (см. `src/lib/ocr/stamp-ocr.ts`, ветка `opts.useVlmFallback !== false`).
  Результат VLM дополнительно валидируется `validateStampFields()` — OCR-артефакты отбрасываются.

- **Почему не 10 000 правил (P1)** — знания должны жить в данных (БД + справочники), а не в весах модели
  и не в жестко закодированных правилах. 460 правил в `Rule` + 573 стандарта + 4 403 записи в справочниках
  обновляются через `db:sync` без перекомпиляции ядра. Ядро `rules.ts` содержит только 18 эталонных правил.

- **Почему SQLite** — простота развёртывания и бэкапа: `cp db/custom.db db/custom.db.bak`.
  Для одного бюро (P3) этого достаточно. Prisma позволяет мигрировать на PostgreSQL без изменения кода.

- **Почему dual-port (1111 + 3333)** — разделение пользовательского трафика и админ-функций на сетевом уровне.
  Порт 3333 принимает только `/admin` и `/api/admin`; в production его можно вынести на внутренний VLAN
  или за reverse proxy с SSL (Caddy). Реализовано в `server.js` через два `createServer()`.

- **Почему детерминированный формат (P5)** — `src/lib/format-detector.ts` возвращает `null` вместо угадывания,
  если aspect ratio не попадает в диапазон A-серии (2% толеранс). Лучше показать «формат не определён»
  и информационное замечание, чем подставить неверный «A3» по умолчанию.

- **Почему координаты (P6)** — каждое замечание привязывается к координате поля штампа (мм), что позволяет
  в UI подсветить конкретное место на чертеже. `getRuleCoords()` в `bench.ts` маппит код правила на
  положение поля по ГОСТ 2.104, а PaddleOCR даёт реальные pixel-координаты из bounding boxes.

---

## Лицензия

MIT — см. `LICENSE` (если применимо). Используемые модели z-ai-web-dev-sdk распространяются
по их собственной лицензии; PaddleOCR — Apache 2.0.
