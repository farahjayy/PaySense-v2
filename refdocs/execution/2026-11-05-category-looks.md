# Execution — A colour and icon for every category

> Plan: `refdocs/plans/2026-11-05-category-looks.md`. **Status: built and verified except applying migration 0004 to the real project (see CHANGELOG 2026-11-05).** Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting
- Read ADR D-43 (categories), D-48 (fixed colour and icon per category) and the new D-64.

## Phase A — backend
### A1. The palette and the listing
- **Files:** `backend/app/domain/categories.py`, `backend/tests/domain/test_categories.py` (or the existing domain categories test).
- **Steps:** `COLOURS` (15 keys) and `ICONS` (12 keys); `CategoryEntry` gains `icon`, `colour`; `build_listing(..., styles)`.
- **Verify:** built-in and own entries carry the person's choice or None; lookup is case-insensitive.

### A2. The table and the repository
- **Files:** `backend/migrations/0004_category_styles.sql`, `backend/migrations/README.md`, `backend/app/db/category_styles.py`, `backend/tests/fakes.py`, `backend/scripts/check_rls.py`, `backend/tests/test_category_styles_repo.py`, `backend/tests/test_user_isolation.py`.
- **Verify:** set, change, clear, move on rename; both-null clears; one person's look is invisible to another (isolation test for each function).

### A3. The API
- **Files:** `backend/app/api/categories.py`, `backend/app/db/account_data.py`, `backend/tests/api/test_categories_api.py`, `backend/tests/api/test_account_api.py`.
- **Verify:** `PUT /api/categories/style` for an own and a built-in category; invalid key 422; unknown name 404; list shows the choice; add with a look; rename carries it; delete clears it; reset of "categories" clears it.

## Phase B — frontend
### B1. Styles and the picker
- **Files:** `frontend/lib/categoryStyle.ts`, `frontend/lib/api/queries.ts` (+ `npm run gen:api`), `frontend/components/ui/CatIcon.tsx`, `frontend/components/categories/StylePicker.tsx`, tests.
- **Verify:** every palette colour passes the contrast test; a chosen look overrides the default; `CatIcon` and the spending bar use the chosen look; the picker selects one colour and one icon and reports them.

### B2. The Categories page
- **Files:** `frontend/components/screens/CategoriesScreen.tsx`, `frontend/tests/unit/CategoriesScreen.test.tsx`.
- **Verify:** every row shows its tile; "Change look" saves and the row updates; built-in rows keep "Fixed" for the name; adding a category with a look sends it; reset to default.

## Wrap-up
- [ ] ADR D-64; PRD §7 one-liner; CHANGELOG; STATUS
- [ ] `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q`; `cd frontend && npm run gen:api && npx tsc --noEmit && npx eslint <changed> && npx vitest run && npx playwright test`, each named with results
- [x] the migration applied to the real project (2026-11-06, through the Supabase connector)
- [ ] `scripts/check_rls.py` (needs `SUPABASE_ANON_KEY`; the author runs it)
