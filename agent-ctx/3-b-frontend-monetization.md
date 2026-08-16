# Task 3-b — Frontend Monetization Agent

## Status: ✅ COMPLETE

## Files Created (5)
- `src/components/nk/nk-usage-bar.tsx` — progress bar with auto-color (green/amber/red/slate)
- `src/components/nk/nk-plan-card.tsx` — pricing plan card (price/features/limits/current highlight)
- `src/components/nk/nk-category-filter.tsx` — button group with colored dots + counts
- `src/components/nk/nk-settings.tsx` — Settings view (5 sections: Org/Subscription/Usage/Users/Plans)
- `src/components/nk/nk-api-keys.tsx` — API Keys view (table + create dialog + secret reveal + API docs)
- `src/components/nk/nk-audit-log.tsx` — Audit Log view (filters + color-coded table + pagination + 30s auto-refresh)

## Files Modified (6)
- `src/stores/nk-store.ts` — extended NKView with 'settings' | 'apikeys' | 'audit'
- `src/hooks/use-nk-api.ts` — added 15+ new hooks (organization/users/api-keys/audit/usage/subscription/plans/standards stats/clauses/downloadReport)
- `src/components/nk/nk-knowledge-base.tsx` — added stats bar + category filter + clauses collapsible + source badge + sourceUrl link
- `src/components/nk/nk-dashboard.tsx` — added "База знаний" stats card with 4 mini-stats
- `src/components/nk/nk-document-detail.tsx` — replaced "В разработке" toast with actual report download via window.open
- `src/app/page.tsx` — added 3 nav items + organization badge in header + real counts in footer + view switch

## Verification
- ✅ `bun run lint` — exit 0, no errors
- ✅ TypeScript: 0 errors in my files (pre-existing errors in others' files untouched)
- ✅ Dev server responds 200 on `/`, all 9 nav items render
- ✅ All new endpoints tested via curl
