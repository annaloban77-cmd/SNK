# Task 2-a — Backend agent

Сводка: реализованы все 18 API-роутов контракта + генератор тестовых чертежей.

## Файлы
См. `/home/z/my-project/worklog.md` (запись с Task ID: 2-a).

## Статус
- ✅ `bun run lint` проходит
- ✅ dev-сервер работает (Turbopack)
- ✅ Все эндпоинты протестированы вручную через curl
- ✅ Пайплайн analyze проверен на 2 тестовых PNG (VLM + rules работают)

## Важное замечание для frontend-агента (2-b)
В БД сейчас 7 документов: 5 демо + 2 тестовых. Тестовые (`sample-1-kronshtein.png` и `АБВ.301455.012_Фланец.png`) созданы моим ручным тестированием `/api/samples/[id]/analyze`. Можно не обращать внимания или удалить пересидом.

## Эндпоинты для UI
- GET `/api/dashboard` — KPI и графики
- GET `/api/documents?status=&format=&sourceType=&projectId=&search=&page=&pageSize=` — список
- GET `/api/documents/[id]` — один документ
- POST `/api/documents/upload` (multipart) — загрузка
- POST `/api/documents/[id]/analyze` (body: `{runLlm?: boolean}`) — анализ
- GET `/api/documents/[id]/file` — превью файла
- GET `/api/documents/[id]/issues` — замечания документа
- GET `/api/issues?...` — все замечания
- PATCH `/api/issues/[id]` (body: `{status}`) — смена статуса
- POST `/api/issues/bulk` (body: `{ids[], action}`) — массово
- GET `/api/standards` + `/api/standards/[id]` — база знаний
- GET `/api/rules` + PATCH `/api/rules/[id]` — правила
- GET `/api/projects` — проекты
- GET `/api/checklog/[documentId]` — журнал проверок
- GET `/api/samples` — список тестовых чертежей
- POST `/api/samples/[id]/analyze?runLlm=false` — быстрый тест

## Тестовые чертежи
- `/samples/sample-1-kronshtein.png` (A3, Кронштейн)
- `/samples/sample-2-flanets.png` (A4, Фланец)
