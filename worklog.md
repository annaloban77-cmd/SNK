# Worklog — НК-Контроль (Система нормативного контроля для судостроения)

Проект: Next.js 16 App Router + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma (SQLite) + z-ai-web-dev-sdk.
Единственная видимая пользователем страница: `/` (src/app/page.tsx). Все остальные данные — через `/api/*`.

## Цель системы
Веб-приложение «помощник нормоконтролера» для судостроительного предприятия:
- Загрузка сканов/чертежей (PDF/PNG/JPG) и CAD-файлов (DWG/DXF/CDW/SLDPRT/SLDASM/SLDDRW/SPW)
- VLM-распознавание полей основной надписи (штампа) по ГОСТ 2.104
- Детерминированные правила нормоконтроля (формат, обозначение, масса, материал, литера, стадия, подписи, ТТ, перечень ГОСТ)
- LLM-семантические проверки (согласованность, противоречия, контроль сварки)
- База знаний ГОСТ/ОСТ/СТО/РД/Регистр
- Управление правилами и замечаниями
- Отчёты и дашборд с метриками

---
Task ID: 1
Agent: lead (Z.ai Code)
Task: Foundation — Prisma schema, lib/zai.ts, lib/types.ts, lib/rules.ts, seed.ts

Work Log:
- Изучил документ-дорожную карту нормоконтроля (24 раздела)
- Создал Prisma-схему: Project, Document, Standard, Rule, Issue, CheckLog, DocType
- Запустил `bun run db:push` — БД синхронизирована
- Создал `src/lib/zai.ts`: обёртка над z-ai-web-dev-sdk с функциями `extractStampFromImage()` (VLM, модель glm-4.5v) и `llmSemanticCheck()` (LLM, модель glm-4.6), парсер `parseJsonLoose()` для прощения markdown-обёрток
- Создал `src/lib/types.ts`: общие DTO — `DocumentDto`, `IssueDto`, `RuleDto`, `StandardDto`, `DashboardStats`, `AnalyzeResponse`, `StampFields`
- Создал `src/lib/rules.ts`: 17 детерминированных правил (R-FORMAT-001, R-STAMP-001/002/003, R-SCALE-001, R-MASS-001, R-MAT-001/002/003, R-LETTER-001, R-STAGE-001, R-SIGN-001/002/003/004, R-TT-001, R-GOST-001) с функциями `toStampFields()`, `runDeterministicRules()`, `fromLlmIssues()`
- Создал `scripts/seed.ts`: 25 стандартов (ГОСТ 2.104, 2.301, 2.302, 2.307, 2.312, 2.316, 2.201, 2.103, 2.106, 2.109, 19281, 5264, 14771, 15150, ОСТ 5Р.0206, СТО, РД, два Регстра), 23 правила, проект СВ-2025-К-104, 5 демо-документов (3 проанализированы с замачаниями, 2 в очереди/с ошибкой)
- Запустил сидинг — все данные в БД

Stage Summary:
- БД готова, сидинг выполнен
- Готов детальный API-контракт (см. ниже) для двух параллельных агентов: backend (API-роуты) и frontend (UI)
- SDK-обёртка и движок правил готовы к использованию в API-роутах

---

# API КОНТРАКТ (для backend-агента и frontend-агента)

Все роуты — относительно корня приложения. Запросы/ответы — JSON (кроме multipart upload).

## 1. GET `/api/dashboard`
Возвращает `DashboardStats`:
```ts
{
  totalDocuments: number,
  analyzedDocuments: number,
  processingDocuments: number,
  pendingDocuments: number,
  totalIssues: number,
  highIssues: number,
  mediumIssues: number,
  lowIssues: number,
  confirmedIssues: number,
  fixedIssues: number,
  avgCheckDurationMs: number | null,
  passRate: number, // 0..100
  issuesBySeverity: [{ name: 'Высокая' | 'Средняя' | 'Низкая', value: number, color: string }],
  documentsByStatus: [{ name: string, value: number, color: string }],
  documentsByFormat: [{ name: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'unknown', value: number }],
  issuesByCategory: [{ name: string, value: number }], // category = stamp/material/format/cad_attr/geometry/semantic
  checksLast14Days: [{ date: 'YYYY-MM-DD', count: number, issues: number }],
  recentDocuments: DocumentDto[], // последние 5
  topIssues: [{ code: string, title: string, count: number, severity: 'high'|'medium'|'low' }] // топ-5 по частоте
}
```

## 2. GET `/api/documents?status=&format=&sourceType=&projectId=&search=&page=1&pageSize=20`
Query-параметры (все опциональные):
- `status`: new | processing | analyzed | failed
- `format`: A0|A1|A2|A3|A4|unknown
- `sourceType`: scan|pdf|dwg|dxf|cdw|sldprt|sldasm|slddrw|spw
- `projectId`: string
- `search`: строка поиска по name/designation
- `page`, `pageSize`: пагинация (default 1 / 20)

Возвращает:
```ts
{ items: DocumentDto[], total: number, page: number, pageSize: number }
```

DocumentDto (см. `src/lib/types.ts`):
```ts
{
  id, projectId, name, originalName, mimeType, size, format, sourceType,
  status, stamp: StampFields | null, ocrText: string | null,
  issueCount, highCount, mediumCount, lowCount, checkDuration: number | null,
  docTypeId: string | null, project: { id, code, name } | null,
  createdAt: string (ISO), updatedAt: string (ISO)
}
```
StampFields = JSON-объект: `{ format, designation, name, scale, mass, material, letter, stage, signatures:{developed,checked,normControl,approved}, dates:{developed,checked,approved}, invNumber, technicalRequirements: string[], gostReferences: string[], documentType, sheetCount, notes }`. В БД хранится в `Document.stampJson` как строка — парсить в `stamp` при возврате.

## 3. GET `/api/documents/[id]`
Возвращает `DocumentDto` с полным `stamp` и `project`.

## 4. POST `/api/documents/upload` (multipart/form-data)
Поля формы:
- `file`: File (обязательно) — PDF/PNG/JPEG/SVG или CAD-файл
- `projectId`: string (опционально)
- `sourceType`: string (опционально, иначе определяется по расширению/mime)
- `format`: string (опционально, иначе 'unknown')

Логика:
- Сохранить файл в `/home/z/my-project/uploads/<cuid>-<sanitized-name>`
- Определить sourceType по расширению (.pdf→pdf, .png/.jpg/.jpeg→scan, .dwg→dwg, .dxf→dxf, .cdw→cdw, .sldprt→sldprt, .sldasm→sldasm, .slddrw→slddrw, .spw→spw)
- Определить format: для изображений/PDF можно попробовать вычислить из пропорций (по желанию), иначе 'unknown'
- Создать Document со status='new'
- Вернуть `{ document: DocumentDto }`

## 5. POST `/api/documents/[id]/analyze`
Тело: `{ runLlm?: boolean = true }` (опционально)

Логика:
1. Поставить status='processing', записать CheckLog(stage='upload', status='started')
2. Прочитать файл с диска. Если это изображение (PNG/JPEG) — конвертировать в data URL (base64). Если PDF — рендерить первую страницу в PNG через `sharp` (если недоступно — пропустить VLM с пометкой) и затем в data URL. Если CAD-файл — пропустить VLM-шаг, оставить stamp=null.
3. Если есть data URL — вызвать `extractStampFromImage(dataUrl)` из `@/lib/zai`
   - Записать CheckLog(stage='vlm_extract', status='success'|'failed', durationMs)
   - Сохранить результат в `Document.stampJson = JSON.stringify(stamp)`
4. Если stamp извлечён — запустить `runDeterministicRules(toStampFields(stamp))` из `@/lib/rules`
   - Записать CheckLog(stage='rules_check', ...)
5. Если `runLlm !== false` и stamp извлечён — вызвать `llmSemanticCheck(stamp, stamp.gostReferences || [])`
   - Записать CheckLog(stage='llm_semantic', ...)
6. Удалить старые Issue для этого документа (status='new'..'auto') и записать новые (из детерминированных + LLM)
7. Пересчитать `issueCount`, `highCount`, `mediumCount`, `lowCount`
8. Поставить status='analyzed', записать CheckLog(stage='report', status='success')
9. Вернуть `AnalyzeResponse`:
```ts
{
  documentId, status: 'analyzed', stamp: StampFields | null,
  issues: IssueDto[], checkDurationMs: number,
  stages: [{ stage, status, durationMs: number | null, message?: string }]
}
```
При ошибке — status='failed', CheckLog(stage, status='failed', message=error), HTTP 200 с `{ error: string }` (но не 500, чтобы фронтенд мог показать).

## 6. GET `/api/documents/[id]/issues?severity=&status=`
Возвращает `{ items: IssueDto[] }` для документа.

## 7. PATCH `/api/issues/[id]`
Тело: `{ status: 'new'|'confirmed'|'rejected'|'fixed' }`
Обновляет статус одного замечания. Возвращает обновлённый `IssueDto`.

## 8. POST `/api/issues/bulk`
Тело: `{ ids: string[], action: 'confirm'|'reject'|'fix' }`
Массово меняет статус. Возвращает `{ updated: number }`.

## 9. GET `/api/issues?page=1&pageSize=20&severity=&status=&documentId=&search=`
Возвращает `{ items: IssueDto[], total: number, page, pageSize }`.
IssueDto:
```ts
{
  id, documentId, ruleId: string | null, code, title, description,
  requirement: string | null, recommendation: string | null, gostRef: string | null,
  field: string | null, severity: 'high'|'medium'|'low', status: 'new'|'confirmed'|'rejected'|'fixed',
  source: 'auto'|'expert'|'llm', evidence: string | null,
  document: { id, name, format } | null,
  rule: { id, code, name } | null,
  createdAt: string (ISO), updatedAt: string (ISO)
}
```

## 10. GET `/api/standards?type=&search=&page=1&pageSize=20`
Возвращает `{ items: StandardDto[], total, page, pageSize }`.
StandardDto: `{ id, code, name, type, scope, description: string|null, status, publishedAt: string|null, rulesCount: number, createdAt, updatedAt }`.
`type`: GOST|OST|STO|RD|REGISTER|ESKD|SPDS

## 11. GET `/api/standards/[id]`
Возвращает `StandardDto` с расширенным полем `rules: RuleDto[]`.

## 12. GET `/api/rules?category=&method=&enabled=&search=&page=1&pageSize=20`
Возвращает `{ items: RuleDto[], total, page, pageSize }`.
RuleDto: `{ id, code, name, description, category, method, severity, gostField: string|null, expression: string|null, enabled, standardId: string|null, standard: {id,code,name}|null, createdAt, updatedAt }`.
`category`: stamp|specification|material|cad_attr|format|geometry|semantic
`method`: deterministic|semantic|vision

## 13. PATCH `/api/rules/[id]`
Тело: частичные поля RuleDto (например `{ enabled: false }` или `{ severity: 'high' }`).
Возвращает обновлённый `RuleDto`.

## 14. GET `/api/projects`
Возвращает `{ items: [{ id, code, name, description, stage, status, documentsCount, createdAt, updatedAt }] }`.

## 15. GET `/api/checklog/[documentId]`
Возвращает `{ items: CheckLog[] }` для истории проверок документа.

## 16. GET `/api/documents/[id]/file`
Отдаёт сам файл (для предпросмотра изображения/PDF в UI). Использует `Response` с правильным Content-Type. Если файл не существует (демо-документы без файла) — 404.

## 17. GET `/api/samples`
Возвращает `{ items: [{ id, title, description, url }] }` — список готовых тестовых чертежей из `/public/samples/`.
Эти PNG-семплы создает backend-агент через `scripts/generate-samples.ts` (sharp + SVG-шаблон): 2 шт. с разными наборами ошибок.

## 18. POST `/api/samples/[id]/analyze`
Загружает выбранный семпл как новый Document (по URL из /public/samples/) и сразу запускает analyze.
Возвращает `AnalyzeResponse`.

---

# UI КОНТРАКТ (для frontend-агента)

## Главная страница `/` (src/app/page.tsx)
'use client'. Использует zustand для текущего раздела или просто useState.
Layout: sticky-header сверху + sidebar слева + main content. Footer sticky снизу.

### Sidebar (collapsible на мобиле)
Пункты:
1. **Дашборд** (LayoutDashboard icon) — по умолчанию
2. **Документы** (FileText icon) — badge со счётчиком новых
3. **Замечания** (AlertTriangle icon) — badge со счётчиком high
4. **База знаний** (BookOpen icon)
5. **Правила** (ListChecks icon)
6. **Проекты** (FolderKanban icon) — опционально

### Top bar
- Логотип «НК-Контроль» + подпись «Система нормативного контроля»
- Индикатор статуса системы (зелёная точка)
- Переключатель темы (light/dark) через next-themes
- Кнопка «Загрузить документ» (открывает dialog)

### Footer (sticky bottom)
- Слева: «© 2025 Северо-Верфь · НК-Контроль v0.1»
- Центр: ссылка на ГОСТ 2.104-2006
- Справа: статус «База знаний: 25 стандартов · 23 правила активны»

### Разделы (компоненты в `src/components/nk/`)

#### Dashboard (`nk-dashboard.tsx`)
- 4 KPI-карточки: Всего документов / Проверено / Замечаний высокой критичности / Среднее время проверки
- 4 графика (recharts):
  - PieChart: распределение замечаний по критичности (issuesBySeverity)
  - BarChart: документы по статусам (documentsByStatus)
  - BarChart: документы по форматам (documentsByFormat)
  - BarChart: замечания по категориям (issuesByCategory)
- Таблица «Последние проверки» (recentDocuments) — name, format, status badge, issues count, duration, дата
- Карточка «Топ замечаний» (topIssues) — список с badge критичности

#### Documents (`nk-documents.tsx`)
- Сверху: фильтры (status, format, sourceType, search) + кнопка «Загрузить»
- Drag-and-drop зона загрузки (или dialog)
- Таблица: имя / формат / тип источника / статус / замечания (с разбивкой high/med/low) / дата / действие
- Клик по строке → открывает DocumentDetail (drawer или отдельный view)

#### DocumentDetail (`nk-document-detail.tsx`)
- Layout: 2 колонки (на мобиле — стопкой)
  - Левая: предпросмотр файла (img/pdf iframe). Для PDF — `<iframe>`. Для CAD-файлов — иконка-плейсхолдер.
  - Правая: извлечённые поля штампа (формат, обозначение, наименование, масштаб, масса, материал, литера, стадия, подписи, даты, ТТ, перечень ГОСТ) в виде таблицы/сетки
- Кнопка «Запустить проверку» (триггерит POST /api/documents/[id]/analyze, показывает прогресс по stages)
- Tabs: Замечания / Извлечённые данные / Журнал проверок
- Замечания: карточки с severity badge, code, title, description, requirement, recommendation, gostRef, status action buttons (Confirm/Reject/Fix)
- Журнал: timeline с этапами проверки и их длительностью

#### Issues (`nk-issues.tsx`)
- Фильтры: severity, status, documentId, search
- Таблица всех замечаний: документ / код / заголовок / критичность / статус / ГОСТ / дата
- Mass actions: выбрать несколько → Confirm/Reject/Fix

#### Knowledge Base (`nk-knowledge-base.tsx`)
- Фильтры: type (GOST/OST/STO/RD/REGISTER/ESKD/SPDS), search
- Сетка карточек: code, name, scope, type badge, status badge, publishedAt, rulesCount
- Клик → модальное окно с полным описанием и списком правил

#### Rules (`nk-rules.tsx`)
- Фильтры: category, method, enabled, search
- Таблица: code, name, category badge, method badge, severity badge, gostField, standard, enabled toggle
- Клик по строке → модальное окно с полным описанием и переключателем enabled

#### Projects (`nk-projects.tsx`)
- Сетка карточек проектов: code, name, stage badge, documentsCount

### Общие компоненты
- `nk-severity-badge.tsx` — badge критичности (high=red, medium=amber, low=blue)
- `nk-status-badge.tsx` — badge статуса документа/замечания
- `nk-source-icon.tsx` — иконка типа источника (scan/pdf/dwg/cdw/sld...)
- `nk-stat-card.tsx` — карточка KPI
- `nk-page-header.tsx` — заголовок раздела с описанием

### Стилистика
- Цвета: использовать theme variables (bg-background, text-foreground, bg-card, border-border)
- НЕ использовать indigo/blue как primary (использовать дефолтную тему shadcn — обычно zinc/neutral)
- Акцентные цвета: emerald для success, amber для warning, red для danger, slate для neutral
- Полностью адаптивно: mobile-first, sidebar коллапсится в drawer на мобиле
- Sticky footer внизу

### Хуки и утилиты
- `src/hooks/use-nk-api.ts` — обёртки fetch для всех эндпоинтов с типизацией
- `src/lib/nk-api.ts` (если не хук) — клиентские функции

### Запросы
Использовать `fetch` напрямую или TanStack Query (уже в зависимостях). Предпочтительно TanStack Query для кэширования.

### Состояние UI
- Zustand store `src/stores/nk-store.ts` для: текущий раздел, выбранный документ, filters

### Загрузка файла
FormData с `file` полем, POST на `/api/documents/upload`. Показать прогресс и toast.

### Тосты
Использовать `sonner` (уже установлен) или существующий `useToast` hook.

---
Важно: backend-агент пишет ТОЛЬКО файлы в `src/app/api/*` и при необходимости обновляет `src/lib/*` (но не types.ts — он уже готов). Frontend-агент пишет ТОЛЬКО `src/app/page.tsx`, `src/components/nk/*`, `src/hooks/*`, `src/stores/*`. Файлы `src/components/ui/*` уже готовы — НЕ менять.

---

Task ID: 2-a
Agent: full-stack-developer (backend)
Task: Реализация всех API-роутов (18 эндпоинтов) + генератор тестовых чертежей

Work Log — созданные файлы:

**API-роуты (src/app/api/):**
1. `src/app/api/_map.ts` — DTO-мапперы: `mapDocument`, `mapIssue`, `mapRule`, `mapStandard`, `parseStamp`, `stampToStorage`, `iso`. Преобразуют Prisma-сущности в DTO из `@/lib/types`, парсят `stampJson` в объект `stamp`, форматируют даты в ISO.
2. `src/app/api/_analyze.ts` — общий пайплайн анализа (используется `/api/documents/[id]/analyze` и `/api/samples/[id]/analyze`): status→processing, чтение файла → data URL (PNG/JPEG напрямую, PDF через `sharp` raster), VLM-извлечение штампа с таймаутом 60с, детерминированные правила, LLM-семантика (с таймаутом), удаление старых issues, вставка новых с lookup ruleId, пересчёт counts, status→analyzed, CheckLog на каждый этап, status→failed при ошибке.
3. `src/app/api/dashboard/route.ts` — GET `/api/dashboard`: агрегаты, распределения по severity/status/format/category, последние 14 дней (count + issues), top-5 issues по коду, последние 5 документов, passRate.
4. `src/app/api/documents/route.ts` — GET `/api/documents` с фильтрами (status/format/sourceType/projectId/search) и пагинацией. Поиск: по `name` + `originalName` + внутри `stampJson.designation/name` (через JS-фильтрацию).
5. `src/app/api/documents/[id]/route.ts` — GET одного документа с project.
6. `src/app/api/documents/upload/route.ts` — POST multipart: сохранение в `uploads/<uuid>-<name>`, определение sourceType по расширению, вычисление формата через `sharp` metadata (по длинной стороне и aspect ratio √2), создание Document со status='new', CheckLog('upload').
7. `src/app/api/documents/[id]/analyze/route.ts` — POST, body `{ runLlm?: boolean }`, делегирует в `runAnalyzePipeline()`.
8. `src/app/api/documents/[id]/issues/route.ts` — GET списка issues документа с фильтрами severity/status.
9. `src/app/api/documents/[id]/file/route.ts` — GET, стримит файл с диска с правильным Content-Type. 404 если filePath пустой (демо-документы).
10. `src/app/api/issues/route.ts` — GET с фильтрами (severity/status/documentId/search по title+code+description) и пагинацией.
11. `src/app/api/issues/[id]/route.ts` — PATCH `{ status }` (валидация: new|confirmed|rejected|fixed).
12. `src/app/api/issues/bulk/route.ts` — POST `{ ids, action }` где action ∈ confirm|reject|fix → status.
13. `src/app/api/standards/route.ts` — GET с фильтрами type/search и пагинацией, includes rulesCount через `_count`.
14. `src/app/api/standards/[id]/route.ts` — GET одного стандарта с `rules: RuleDto[]`.
15. `src/app/api/rules/route.ts` — GET с фильтрами category/method/enabled/search и пагинацией, includes standard.
16. `src/app/api/rules/[id]/route.ts` — PATCH частичного обновления (whitelist полей).
17. `src/app/api/projects/route.ts` — GET списка проектов с documentsCount.
18. `src/app/api/checklog/[documentId]/route.ts` — GET логов проверок документа по возрастанию createdAt.
19. `src/app/api/samples/route.ts` — GET списка тестовых чертежей (статический манифест + проверка наличия файла на диске, поле `available`).
20. `src/app/api/samples/[id]/analyze/route.ts` — POST: копирует sample-файл в uploads/, создаёт Document (привязка к проекту СВ-2025-К-104), запускает `runAnalyzePipeline()`.

**Скрипт и тестовые чертежи:**
- `scripts/generate-samples.ts` — генератор 2 SVG → PNG через `sharp`. Шаблоны A3 (Кронштейн) и A4 (Фланец) с реалистичной штамп-формой ГОСТ 2.104 (Изм./Лист/№ докум./Подп./Дата, Разраб./Пров./Н.контр./Утв. с ФИО+дата, Лит./Масса/Масштаб, Стадия/Лист/Листов, наименование/обозначение/организация), рамка, простые проекции (L-кронштейн с отверстиями и размерами / фланец с 8 болт-отверстиями и разрезом А-А), блок ТТ, перечень ГОСТ.
- `public/samples/sample-1-kronshtein.png` (67 KB, 1600×1131) — А3, обозначение АБВ.301254.001, **заложенные ошибки**: масса «12,5 кг.» (лишняя точка → R-MASS-001), материал «Сталь 09Г2С» без ГОСТ (R-MAT-002), в перечне нет ГОСТ 19281 (R-MAT-003), пустая подпись Н.контр. (R-SIGN-003).
- `public/samples/sample-2-flanets.png` (89 KB, 1000×1414) — А4 портрет, обозначение АБВ.301455.012, **заложенные ошибки**: пустой материал (R-MAT-001), пустая стадия (R-STAGE-001), пустая подпись Утв. (R-SIGN-004), масштаб 1:3 нестандартный (R-SCALE-001).

Stage Summary:

**API-роуты (все 18 контрактовых + 1 доп.):**
- Dashboard, Documents (list/get/upload/analyze/file/issues), Issues (list/patch/bulk), Standards (list/get), Rules (list/patch), Projects, CheckLog, Samples (list/analyze) — ✅ все реализованы, протестированы вручную через curl.
- Все роуты помечены `export const dynamic = 'force-dynamic'`.
- Все используют `NextResponse.json()` и `import { db } from '@/lib/db'`.
- Анализ-пайплайн инкапсулирован в `_analyze.ts` и переиспользуется в `/samples/[id]/analyze`.
- VLM/LLM-вызовы обёрнуты в `Promise.race` с таймаутом 60с.
- Пайплайн корректно логирует все этапы в `CheckLog` (upload/vlm_extract/rules_check/llm_semantic/report) с durationMs и message.

**Сгенерированные чертежи:**
- 2 PNG-файла в `/public/samples/`, общим объёмом ~156 KB.
- Запуск: `bun run scripts/generate-samples.ts` (idempotent — перезаписывает файлы).
- Проверено: VLM (glm-4.5v) корректно извлекает обозначение, наименование, масштаб, ГОСТ-перечень, ТТ, подписи; мелкие поля (масса/материал) иногда распознаются неполно — это VLM-имперфектность, не баг бэкенда.

**Тестирование (вручную через curl):**
- `/api/dashboard` ✅ — возвращает полный DashboardStats
- `/api/documents` с фильтрами и search ✅
- `/api/documents/[id]` ✅
- `/api/documents/upload` (multipart PNG) ✅ — файл сохранён в `uploads/`, Document создан
- `/api/documents/[id]/analyze` (runLlm=false) ✅ — VLM 3.5с, 2 замечания, статус analyzed
- `/api/samples/sample-2-flanets/analyze` ✅ — копирование + анализ, 4 замечания (R-MAT-001, R-STAGE-001, R-SIGN-004, R-SCALE-001)
- `/api/issues` PATCH + bulk ✅
- `/api/standards` + `/api/standards/[id]` ✅
- `/api/rules` + `/api/rules/[id]` PATCH ✅
- `/api/projects` ✅
- `/api/checklog/[documentId]` ✅ — timeline из 6 этапов
- `/api/documents/[id]/file` ✅ — отдаёт PNG, 404 для демо-документов без файла
- `/api/samples` ✅ — возвращает 2 элемента с `available: true`

**Issues / Caveats:**
1. **КРИТИЧЕСКИЙ ФИКС**: в `src/lib/rules.ts` строка 195 (правило R-MAT-002) содержала синтаксическую ошибку — строка открывалась одинарной кавычкой `'`, а закрывалась backtick `` ` ``. Файл не парсился ни ESLint, ни bun, и импорт `runDeterministicRules` падал. Хотя в инструкциях этот файл помечен как «read-only — уже complete», он был фактически сломан. Исправлен один символ (`` ` `` → `'`) — без этого не работал бы ни один analyze-запрос. Все остальные 16 правил не трогались.
2. **VLM-имперфектность**: модель glm-4.5v иногда путает столбцы штампа (например, переносит «Сидоров С.С.» из графы «Утв.» в «Н.контр.», или нормализует «12,5 кг.» в «12,5 кг» без точки). Это не баг бэкенда — это свойство модели. Правила корректно срабатывают на том, что извлёк VLM.
3. В БД остались 2 тестовых документа (`sample-1-kronshtein.png`, `АБВ.301455.012_Фланец.png`) с `status='analyzed'` — они созданы во время ручного тестирования analyze-пайплайна. Можно удалить через `/api/documents/[id]` DELETE (не реализован) или пересидить БД (`bun run db:reset` + `bun run scripts/seed.ts`).
4. `format` определяется эвристически по длинной стороне и aspect ratio — для реальных сканов с разрешением ~150-200 DPI работает приемлемо, но для произвольных изображений может ошибаться. В UI стоит дать пользователю возможность вручную указать формат.
5. `bun run lint` — ✅ проходит без ошибок и предупреждений (после фикса `rules.ts` и замены `interface AnalyzeResult extends AnalyzeResponse {}` на `type AnalyzeResult = AnalyzeResponse` в `_analyze.ts`).
6. Папка `agent-ctx/` создана, но work-record пишется в общий `worklog.md` согласно шаблону lead-агента.

---

Task ID: 2-b
Agent: full-stack-developer (frontend)
Task: Реализация frontend SPA для НК-Контроль — единая страница `/` с sidebar + 7 views (Дашборд, Документы, Детали документа, Замечания, База знаний, Правила, Проекты), Zustand store, TanStack Query API-клиент, общие NK-компоненты, layout с ThemeProvider/QueryClientProvider/Sonner.

Work Log — созданные/изменённые файлы:

**Layout & Providers:**
1. `src/app/layout.tsx` — обновлён: `lang="ru"`, metadata title «НК-Контроль — Система нормативного контроля», description на русском, обёрнут в `<NKProviders>` (ThemeProvider attribute="class" defaultTheme="light" + QueryClientProvider), оставлен `<Toaster/>` (radix), добавлен `<SonnerToaster/>` (sonner).
2. `src/components/nk/nk-providers.tsx` — клиентский провайдер: `next-themes` ThemeProvider + `@tanstack/react-query` QueryClientProvider (staleTime=30s, retry=1).

**State & API:**
3. `src/stores/nk-store.ts` — Zustand-стор: `view` (7 разделов), `selectedDocumentId`, `documentsProjectId` (фильтр-override из Projects view), `mobileNavOpen`. Все экшены иммутабельны через `set({ ... })`.
4. `src/hooks/use-nk-api.ts` — TanStack Query-хуки для всех 18 эндпоинтов контракта:
   - Queries: `useDashboard`, `useDocuments`, `useDocument`, `useDocumentIssues`, `useIssues`, `useStandards`, `useStandard`, `useRules`, `useProjects`, `useCheckLog`, `useSamples`.
   - Mutations: `useUploadDocument` (FormData), `useAnalyzeDocument` (POST + invalidate 5 query-ключей), `useUpdateIssue` (PATCH), `useBulkIssues` (POST), `useUpdateRule` (PATCH partial), `useAnalyzeSample` (POST с копированием).
   - Низкоуровневый `apiFetch<T>` с обработкой JSON-error, `buildQS` для фильтров (skip null/''/'all').
   - Все мутации показывают toast (success/error) через `sonner`.
   - `keepPreviousData` на пагинируемых списках.

**Shared NK components (`src/components/nk/`):**
5. `nk-format.ts` — утилиты форматирования: `formatDateTime` (dd.MM.yyyy HH:mm), `formatDate`, `formatBytes` (Б/КБ/МБ/ГБ), `formatDuration` (мс/с/мин), словари `CATEGORY_LABELS`, `METHOD_LABELS`, `STANDARD_TYPE_LABELS`, `SOURCE_TYPE_LABELS`, `STAGE_LABELS`, `STAGE_STATUS_LABELS`, `ISSUE_SOURCE_LABELS` и функции-обёртки. Использует `date-fns` + locale `ru`.
6. `nk-severity-badge.tsx` — `<SeverityBadge severity>` (red/amber/slate + иконка), `<IssuesSummary high medium low>` (H:N M:N L:N бейджи).
7. `nk-status-badge.tsx` — `<DocStatusBadge status>` (new/processing/analyzed/failed с иконкой Loader2/CheckCircle2/XCircle), `<IssueStatusBadge status>` (new/confirmed/rejected/fixed).
8. `nk-source-icon.tsx` — `<SourceIcon sourceType>` (Image/FileText/Box/Boxes/File/FileCog), `<SourceBadge>` (иконка + русская подпись).
9. `nk-stat-card.tsx` — `<StatCard label value icon tone hint loading>`: 5 тонов (slate/emerald/amber/red/sky), тон-цветной квадрат с иконкой, загрузочный skeleton, обёрнуто в shadcn Card.
10. `nk-page-header.tsx` — `<PageHeader title description actions>`: заголовок раздела, описание и слот для действий (responsive flex).
11. `nk-empty-state.tsx` — `<EmptyState icon title description action>`, `<ErrorState message onRetry>` (красная рамка + кнопка «Повторить»).
12. `nk-upload-dialog.tsx` — `<UploadDocumentDialog>`: drag-drop зона + `<input type=file accept>`, Select проекта (из `useProjects`), кнопки «Отмена»/«Загрузить» с loading-state, on success вызывает `onUploaded(docId)`.
13. `nk-issue-card.tsx` — `<IssueCard issue>`: severity + code + status + source бейджи, заголовок, описание, требование (фон muted), рекомендация (фон emerald), ГОСТ-ссылка, кнопки Подтвердить/Отклонить/Исправлено + dropdown с «Сбросить», кнопка «Подробнее/Свернуть».

**Views (`src/components/nk/`):**
14. `nk-dashboard.tsx` — `<Dashboard>`: 4 KPI-карточки (StatCard), 4 графика (recharts PieChart для severity + 3 BarChart для status/format/category, обёрнуты в `<ChartContainer>` + `<ChartTooltip>` с ChartConfig), таблица «Последние документы» (5 строк, click→document-detail), карточка «Топ замечаний» с severity-бейджами и счётчиком. Skeleton-загрузка.
15. `nk-documents.tsx` — `<Documents>`: фильтры (status/format/sourceType/search с debounce 350мс) + кнопки Refresh/Samples/Upload, dropdown «Тестовые чертежи» (из `useSamples`, click→`useAnalyzeSample`), таблица с колонками Имя/Формат/Тип/Статус/Замечания (IssuesSummary)/Размер/Дата/Действия, row-click → document-detail, dropdown «Открыть/Запустить проверку/Скачать оригинал», пагинация (shadcn Pagination), EmptyState.
16. `nk-document-detail.tsx` — `<DocumentDetail>`: layout 2 колонки. Слева — `<DocumentPreview>` (img для image/, iframe для PDF, иконка Box для CAD). Справа — `<StampCard>` с полями основной надписи (Формат/Обозначение/Наименование/Масштаб/Масса/Материал/Литера/Стадия/Инв.номер/Листов/Тип/Примечания + блок Подписи 4 роли + блок Даты + ТТ нумерованным списком + Перечень ГОСТ бейджами). Action bar: Назад/Скачать отчёт (toast «В разработке»)/Запустить проверку (с Progress-баром во время analyze). Tabs: Замечания (список `<IssueCard>` с badge-счётчиком) / Журнал проверок (timeline с цветными кружками по status, длительность, дата) / Сырые данные (pre JSON).
17. `nk-issues.tsx` — `<Issues>`: фильтры severity/status/documentId/search, bulk-actions бар (появляется при selected.size>0), таблица с Checkbox-колонкой (с indeterminate), колонки Документ/Код/Заголовок/Критичность/Статус/ГОСТ/Дата, row-click → document-detail родителя, кнопки Назад/Вперёд + счётчик страниц.
18. `nk-knowledge-base.tsx` — `<KnowledgeBase>`: фильтры type/search, сетка карточек стандарта (code/тип/name/scope/status/publishedAt/rulesCount), click → `<StandardDetailDialog>` с полным описанием + списком связанных правил.
19. `nk-rules.tsx` — `<Rules>`: фильтры category/method/enabled/search, таблица с колонками Код/Название/Категория (тонированный badge)/Метод/Критичность/ГОСТ-поле/Стандарт/Включено (Switch toggle → PATCH)/Детали (глаз). `<RuleDetailDialog>` с полным описанием + Select критичности + кнопка «Включить/Отключить правило».
20. `nk-projects.tsx` — `<Projects>`: сетка карточек (code/стадия/name/description/documentsCount/createdAt), кнопка «Показать документы» → переключает на Documents view с `documentsProjectId`-фильтром.

**Main page (`src/app/page.tsx`):**
21. `src/app/page.tsx` — единый SPA: `min-h-screen flex flex-col bg-background`, sticky header (Ship-иконка + «НК-Контроль» + подпись + статус-индикатор + theme-toggle + Upload-кнопка), sidebar (desktop: sticky `w-60` левый, mobile: Sheet-_drawer через `useIsMobile`), main content (switch на `view`), sticky footer (© 2025 Северо-Верфь · ЕСКД/СПДС/Регистр РФ бейджи · База знаний 25 стандартов · 23 правила). Nav-items: Дашборд/Документы (badge pendingDocuments)/Замечания (badge highIssues)/База знаний/Правила/Проекты. DocumentDetail рендерится как 7-й view.

Stage Summary:

**Что работает:**
- ✅ `bun run lint` проходит без ошибок и предупреждений.
- ✅ Dev-сервер компилирует все файлы, `GET /` → 200 (HTML рендерится с русским контентом «НК-Контроль», «Дашборд», «Система нормативного контроля»).
- ✅ Все API-эндпоинты отвечают 200 (проверено через curl: dashboard, projects, documents, issues, standards, rules, checklog, samples, file).
- ✅ TanStack Query кэширует и инвалидирует: мутации upload/analyze/issue-patch/bulk/rule-patch корректно рефрешат связанные списки.
- ✅ Sticky footer (mt-auto в flex-col), mobile-first responsive (sidebar → Sheet на <768px), все touch-targets ≥36px.
- ✅ Тема light/dark через next-themes (toggle в header), дефолт light, без indigo/blue primary.
- ✅ Даты в формате dd.MM.yyyy HH:mm (date-fns ru), длительность «X.X с» / «Y мин Z с», размер «248.3 КБ».
- ✅ Toast на все мутации (sonner, top-right, richColors, closeButton).

**Caveats / примечания:**
1. **ThemeProvider без `enableSystem`**: в инструкциях было `defaultTheme="light"` без указания system. Поскольку пользователь — нормоконтролёр, я зафиксировал `defaultTheme="light"` и `enableSystem={false}` для предсказуемости. Тёмная тема доступна через toggle в header.
2. **Лёгкая деградация для CAD-файлов**: превью для .dwg/.cdw/.sld* показывает иконку + сообщение «CAD-файл требует конвертации» + кнопку «Скачать оригинал». Анализ CAD работает (если VLM-шаг пропускается, остальные правила срабатывают на отсутствующем штампе).
3. **Footer текст «25 стандартов · 23 правила» захардкожен** — инструкцией разрешено («can be static text or fetched»). При желании можно сделать fetch `/api/standards?pageSize=1` и `/api/rules?pageSize=1` для счётчиков (но это лишние 2 запроса на каждый рендер layout).
4. **`useUpdateIssue` инвалидейтит все `document-issues` и `issues` ключи** (не парится с поиском конкретного documentId в кэше) — небольшое over-invalidation, но безопасно и просто.
5. **`useDashboard` вызывается и в `page.tsx` (для badge в sidebar), и в `nk-dashboard.tsx`** — но обе подписки используют один queryKey `['dashboard']`, так что фактически один сетевой запрос.
6. **`sample-2-flanets.png` тест в dev.log** (`POST /api/samples/sample-2-flanets/analyze?runLlm=false 200 in 3.9s`) показывает, что весь пайплайн фронтенда работает: dropdown → mutation → toast → переход на document-detail с реальным результатом проверки.
7. **Не реализовано** (MVP-ограничение): удаление документов, ручное указание формата при загрузке (только auto-detect), пакетная печать отчётов, экспорт в Excel/PDF. Всё это можно добавить без переделки архитектуры.
8. **`bun run lint`** ругался на `eslint-disable-next-line @next/next/no-img-element` (правило отключено в eslint.config.mjs) — убрал неиспользуемую директиву, теперь 0 warnings.
9. **Не трогал**: `src/app/api/**`, `src/lib/**`, `src/components/ui/**`, `prisma/**`, `scripts/**`, `package.json` — только свои файлы в `src/app/{page,layout}.tsx`, `src/components/nk/**`, `src/hooks/use-nk-api.ts`, `src/stores/nk-store.ts`.

---

Task ID: 3-b
Agent: full-stack-developer (frontend)
Task: Frontend monetization — Settings / API Keys / Audit Log views + KB improvements + Dashboard KB stats card + report export + org badge in header

Work Log — созданные/изменённые файлы:

**State & hooks:**
1. `src/stores/nk-store.ts` — расширил `NKView` тремя новыми разделами: `'settings' | 'apikeys' | 'audit'`. Полный список: dashboard/documents/issues/knowledge/rules/projects/document-detail/settings/apikeys/audit.
2. `src/hooks/use-nk-api.ts` — добавил 15+ новых хуков для monetization:
   - Queries: `useStandardsStats`, `useStandardClauses(id)`, `useOrganization`, `useOrgUsers`, `useApiKeys`, `useAuditLog(filters)` (с `refetchInterval: 30_000`), `useUsageStats`, `useSubscription`, `usePlans` (handles both array & { items:[] } response).
   - Mutations: `useUpdateOrganization` (PATCH), `useInviteUser` (POST), `useUpdateUser` (PATCH role/status), `useCreateApiKey` (POST, returns `ApiKeyWithSecret`), `useUpdateApiKey` (PATCH status), `useDeleteApiKey` (DELETE).
   - Helper: `downloadReport(documentId)` — `window.open('/api/reports/{id}/html', '_blank')`.
   - Расширил `StandardFilters` полями `category` и `source`.
   - Добавил тип `AuditFilters` и `PlanItem`.

**Shared components (новые):**
3. `src/components/nk/nk-usage-bar.tsx` — `<UsageBar label value max percent?>` — прогресс-бар с авторасчётом тона: green (<60%), amber (60-90%), red (>90%), slate (0). Используется в Settings (использование) и API Keys (requestsCount/requestsLimit).
4. `src/components/nk/nk-plan-card.tsx` — `<PlanCard plan current? onSelect?>` — карточка тарифа: имя, цена (с валютой и интервалом), 4 лимита в сетке, список features с зелёными галочками, подсветка популярного/текущего плана (emerald ring), CTA-кнопка. Используется в Settings (3 плана + сравнение в диалоге).
5. `src/components/nk/nk-category-filter.tsx` — `<CategoryFilter options value onChange>` — кнопочная группа категорий с цветными точками и счётчиками. Используется в Knowledge Base для фильтра по 11 категориям стандартов.

**Updated views:**
6. `src/components/nk/nk-knowledge-base.tsx` — улучшения:
   - **Stats bar** сверху: 4 mini-stat карточки (Всего стандартов / Действующих / С пунктами / Категорий) из `useStandardsStats()`.
   - **Category filter** — кнопочная группа из `useStandardsStats().byCategory` с цветными точками и счётчиками (11 категорий: ЕСКД/ЕСТД/ЕСПД/СПДС/Сварка/Материалы/Допуски/Судостроение/Регистр/РД/СТО).
   - **Source filter** — Select (manual/cntd/rs-class/rr-reg).
   - **Source badge** на каждой карточке стандарта (иконка + подпись, тонированный).
   - **clausesCount** badge (если >0) — «N п.» в amber.
   - В detail-диалоге: **collapsible-секция "Ключевые пункты"** с пунктами из `useStandardClauses(id)` — номер, заголовок, текст, severity-badge.
   - Кнопка **«Открыть оригинал»** (link на `sourceUrl`, открывается в новой вкладке) если есть.
7. `src/components/nk/nk-dashboard.tsx` — добавил карточку **«База знаний»** под 4 KPI: иконка Library в emerald-квадрате, кнопка «Открыть» → Knowledge view, 4 mini-stat: Стандартов (420) / Правил (65) / Категорий (11) / Действующих (420). Данные берёт из extended `useDashboard()` (standardsCount/rulesCount/categoriesCount) с fallback на `useStandardsStats()`.
8. `src/components/nk/nk-document-detail.tsx` — заменил заглушку `toastDownload()` (тост «В разработке») на реальный экспорт: кнопка «Скачать отчёт» теперь вызывает `downloadReport(docId)` (`window.open('/api/reports/{id}/html', '_blank')`) с предварительным тостом «Подготовка отчёта…».

**New views:**
9. `src/components/nk/nk-settings.tsx` — `<Settings>` с 5 секциями:
   - **Организация** — карточка с формой: name (редактируемое), slug/inn (readonly disabled), contactEmail, contactPhone. Кнопка «Сохранить» → `useUpdateOrganization()`, dirty-state detection.
   - **Подписка** — карточка с текущим тарифом (имя + badge), суммой (₽/мес), статусом, периодом (начало/конец), платёжной системой. Кнопки «Сравнить тарифы» (dialog с 3 PlanCard) и «Изменить тариф» (тост «Свяжитесь с отделом продаж»).
   - **Использование** — 4 UsageBar (documents/checks/users/api-requests) с авторасчётом тона; trial-days-left warning.
   - **Пользователи** — таблица в ScrollArea (max-h-28rem): email+name, role-badge, status-badge, lastLoginAt, dropdown с role-change (4 роли) и status toggle (active/disabled). Кнопка «Пригласить» → диалог с email/name/role.
   - **Тарифные планы** — 3 PlanCard (free/pro/enterprise), текущий тариф подсвечен emerald-ring.
10. `src/components/nk/nk-api-keys.tsx` — `<ApiKeys>`:
    - Header с кнопками Refresh + «Создать API-ключ».
    - **Alert** с предупреждением о безопасности (ключ показывается только один раз).
    - Таблица в ScrollArea: name + masked keyPrefix («nk-pro-k••••••••»), scopes (badges read/write/admin), UsageBar (requestsCount/requestsLimit), lastUsedAt, expiresAt, status badge, dropdown (Revoke/Delete).
    - **Create dialog**: name input + scopes checkboxes (3 варианта). На success — открывается **SecretRevealDialog** (AlertDialog): показывает полный secret в моноширинном блоке, кнопка Copy (clipboard API), warning «Сохраните ключ, он больше не будет показан», кнопка «Я сохранил ключ».
    - **Revoke** confirm dialog (amber action) → PATCH status=revoked.
    - **Delete** confirm dialog (red action) → DELETE.
    - **API documentation** card — 3 примера curl (список стандартов / анализ документа / получение документа), кнопка «Копировать» для каждого.
11. `src/components/nk/nk-audit-log.tsx` — `<AuditLog>`:
    - Filters: action (Select с 8 категориями: organization/user/apikey/rule/standard/document/api), userId (Select из `useOrgUsers()` с опциями «Все»/«Система»/список пользователей).
    - Бейдж «Авто-обновление 30с» (использует `refetchInterval: 30_000` в useAuditLog).
    - Таблица в ScrollArea: timestamp (formatDateTime), user (email+name или «Система» с Cpu-иконкой), action (badge с цветом по типу: green=create/invite, blue=update/view, red=delete/revoke + иконка глагола), resource (type + truncated id), IP (с Globe-иконкой), details (expandable Collapsible с JSON).
    - **Pagination**: «Назад/Вперёд» + «стр. X из Y» + «Показано N–M из K».

**Main page:**
12. `src/app/page.tsx` — обновлён layout:
    - Добавил 3 новых nav-items после «Проекты»: **Настройки** (Settings icon), **API-ключи** (KeyRound icon), **Аудит** (History icon).
    - В header добавил **organization badge** (между статусом и theme-toggle): кнопка с slug + plan-badge (Pro=emerald, Free=slate, Enterprise=violet) + Sparkles-иконка. Клик → `setView('settings')`. Hidden на mobile (`hidden sm:flex`).
    - Footer: заменил hardcoded «25 стандартов · 23 правила» на реальные `dash.standardsCount ?? statsQ.data.total` и `dash.rulesCount`. Если данные ещё грузятся — показывает «…».
    - В sidebar-footer добавил организацию: «Организация: {slug}».
    - В view-switch добавил 3 новых case: settings → `<SettingsView/>`, apikeys → `<ApiKeys/>`, audit → `<AuditLog/>`.

Stage Summary:

**Что работает:**
- ✅ `bun run lint` проходит без ошибок и предупреждений (exit 0).
- ✅ TypeScript: в моих файлах (src/components/nk/nk-*, src/hooks/use-nk-api.ts, src/stores/nk-store.ts, src/app/page.tsx) 0 ошибок (есть pre-existing ошибки в чужих файлах: nk-documents.tsx, nk-rules.tsx, _analyze.ts, lib/rules.ts — не в моём scope).
- ✅ Dev-сервер отвечает 200 на `/`, HTML содержит все 9 nav-items: Дашборд/Документы/Замечания/База знаний/Правила/Проекты/Настройки/API-ключи/Аудит.
- ✅ Проверены curl'ом все новые endpoints: /api/organization, /api/organization/users, /api/organization/api-keys, /api/organization/audit, /api/organization/usage, /api/organization/subscription, /api/organization/plans, /api/standards/stats, /api/standards?category=welding, /api/standards?source=cntd, /api/reports/{id}/html (200 text/html).
- ✅ TanStack Query: useAuditLog с `refetchInterval: 30_000` — auto-refresh каждые 30 секунд.
- ✅ Все мутации показывают toast (success/error) и инвалидируют правильные query-ключи.
- ✅ Copy-to-clipboard работает в API Keys (secret reveal + curl examples).
- ✅ Report export: `window.open('/api/reports/{id}/html', '_blank')` — открывает HTML-отчёт в новой вкладке.
- ✅ Responsive: таблицы в ScrollArea (max-h-40rem), mobile sidebar → Sheet, мобильные breakpoints sm:/md:/lg:.

**Caveats / примечания:**
1. **Pre-existing Turbopack cache corruption errors** в `dev.log` (`Failed to restore task data`, `No such file or directory .sst`) — не связаны с моими изменениями, это внутренний кэш Turbopack. Сервер всё равно отвечает 200 на `/` и API.
2. **Plan change MVP**: кнопка «Изменить тариф» показывает тост «Свяжитесь с отделом продаж» — реальная интеграция с платёжной системой (YooKassa) вне scope этого task'а.
3. **Audit auto-refresh**: `refetchInterval: 30_000` работает только когда вкладка активна (TanStack Query по умолчанию не обновляет в фоне) — это правильно, чтобы не нагружать сервер.
4. **API Keys secret**: показывается один раз в `SecretRevealDialog`. После закрытия окна восстановить нельзя — это соответствует требованиям безопасности. В таблице отображается только `keyPrefix` (первые 8 символов + bullets).
5. **Settings organization form**: slug и inn — readonly (disabled), только name/email/phone можно редактировать. Это соответствует контракту PATCH /api/organization.
6. **Knowledge base category filter**: 12 категорий (11 + «Все»), кнопочная группа с wraps. Цвета берутся из `useStandardsStats().byCategory[].color` (sky/yellow/red/orange/violet/amber/cyan/lime/teal/pink/green/slate).
7. **Footer counts**: использует `dash.standardsCount` (extended dashboard) с fallback на `statsQ.data.total` — если endpoint /api/dashboard ещё не вернул standardsCount, но /api/standards/stats уже загрузился, покажется statsQ значение.
8. **Plan badge в header**: скрыт на mobile (`hidden sm:flex`) для экономии места — на мобильном organization badge не помещается рядом с другими кнопками. Slug показывается в sidebar footer.
9. **Не трогал**: `src/app/api/**`, `src/lib/**`, `src/components/ui/**`, `prisma/**`, `scripts/**`, `package.json`, существующие файлы `nk-documents.tsx`, `nk-rules.tsx`, `nk-issues.tsx`, `nk-projects.tsx`, `nk-status-badge.tsx`, `nk-severity-badge.tsx`, `nk-source-icon.tsx`, `nk-stat-card.tsx`, `nk-page-header.tsx`, `nk-empty-state.tsx`, `nk-upload-dialog.tsx`, `nk-issue-card.tsx`, `nk-format.ts`, `nk-providers.tsx`.

