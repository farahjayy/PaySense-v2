# Plan — A colour and icon for every category, chosen by the person

> Execution: `refdocs/execution/2026-11-05-category-looks.md`. Scope source: the author's review of the Categories page ("plain and empty"; match the Transactions page's icons and colours; let a person choose a colour and icon from the existing ones; "make the fixed categories editable too").

## 1. Why this exists

The Transactions page shows every category as a coloured tile with a glyph (D-48). The Categories page lists the same categories as bare text, so it looks unfinished next to it, and a category the person adds can only take a colour derived from its name, with a generic tag glyph. A person cannot make "Gym" look like they want, or tell two of their own categories apart at a glance.

## 2. What's already covered

- `frontend/lib/categoryStyle.ts`: fifteen glyphs, sixteen built-in styles, five colours for the person's own, all checked for 3:1 contrast against the card and a white glyph.
- `CatIcon` draws the tile; `CategorySpending` and the transaction rows use it.
- `GET/POST/PATCH/DELETE /api/categories` manage the person's own categories (D-43); the twelve built-in names (plus BNPL) are code, not rows.

## 3. Scope

**In**
1. The Categories page shows each category's tile (built in and own) next to its name, as on Transactions.
2. **Choose a look.** Any category, built in or the person's own, can be given a colour and an icon from a fixed set (the ones the app already uses): 15 colours, 12 icons. A "Change look" button opens a dialog with a live preview; "Use the default look" puts it back. Adding a category offers the same choice.
3. The choice is stored per person and shown everywhere a category is drawn (transaction rows, the spending-by-category card and bar), not only on the Categories page.
4. **Names of the built-in categories stay fixed** (D-43): the importer and both engines key off them (Refund, Transfer, BNPL). "Editable" for a built-in category means its look.
5. A renamed category keeps its look; a deleted one loses it; "Clear my data → My own categories" clears all looks too.

**Out**
- Free colour pickers, custom icon upload or emoji (contrast, safety and the "colour is never the only signal" rule need a fixed, tested set).
- Renaming or deleting a built-in category.
- Looks in the JSON export (the export lists names; a look is cosmetic).

## 4. Design

- **Storage.** New table `user_category_styles (id, user_id, name, icon, colour, created_at)`, unique on `(user_id, lower(name))`, RLS on with no policies (same lock-down as 0002). A row exists only when the person chose something; both columns nullable (null = the default for that part). Migration `0004_category_styles.sql`.
- **Validation.** Icon and colour are allow-listed keys (`app/domain/categories.py`: `ICONS`, `COLOURS`), enforced by Pydantic `Literal`s, so the OpenAPI types the frontend uses are the same lists and a colour string can never reach a CSS `style` unchecked. The palette is keys (`ocean`, `teal`, ...), the hex lives only in the frontend.
- **API.** `CategoryOut` gains `icon` and `colour` (the person's choice, or null). `PUT /api/categories/style {name, icon, colour}` sets it (both null clears it; 404 for a name that is not a category the person has or a built-in one). `POST /api/categories` accepts the two optional fields. Rename moves the row; delete removes it; reset removes them.
- **Frontend.** `categoryStyle.ts` gains the key-to-hex and key-to-glyph maps and `styleOf(name, choice)`; `useCategoryStyle()` reads the cached categories and hands `CatIcon` and the bar the right style; `StylePicker` is the dialog body (colour swatches and icon grid as pressed-state buttons with names, a preview tile).
- **Security.** Every query is user-scoped (`ScopedTable`) with an isolation test; the new write is rate-limited like the other category writes; no HTML or free text is stored.

## 5. Risks

- **A schema change needs the migration applied to the real project** before the running app can list categories; until then the endpoint would fail. Mitigation: the file is written and checked on the in-memory database; applying it is the author's call (CLAUDE.md "needs the author").
- **Colour as the only signal.** Mitigation: the name is always written beside the tile, and every palette colour is tested for contrast (existing test extended).
- **Two sources of truth for the palette** (backend keys, frontend hex). Mitigation: the frontend maps are typed against the generated OpenAPI unions, so a key added on one side fails the typecheck on the other.
