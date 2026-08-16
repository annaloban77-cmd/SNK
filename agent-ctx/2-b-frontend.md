# Task 2-b — Frontend agent

Сводка: реализован полный SPA-фронтенд для НК-Контроль.

## Файлы (22 шт.)
См. `/home/z/my-project/worklog.md` (запись с Task ID: 2-b).

## Статус
- ✅ `bun run lint` проходит без ошибок и предупреждений
- ✅ Dev-сервер работает, `GET /` → 200
- ✅ Все 18 API-эндпоинтов вызываются через TanStack Query
- ✅ Sticky footer, mobile-first, light/dark тема, русская локаль

## Что важно знать другим агентам
- Не трогать: `src/app/{page,layout}.tsx`, `src/components/nk/**`, `src/hooks/use-nk-api.ts`, `src/stores/nk-store.ts` — эти файлы принадлежат frontend-агенту.
- API-контракт не менялся — все эндпоинты используются как есть.
- Zustand-стор `useNKStore` хранит `view`, `selectedDocumentId`, `documentsProjectId`, `mobileNavOpen`.
- TanStack Query-ключи: `dashboard`, `documents`, `document`, `document-issues`, `issues`, `standards`, `standard`, `rules`, `projects`, `checklog`, `samples`. Если backend добавляет новые эндпоинты, используйте те же ключи для инвалидации.
