# Plan — A simple admin role, and the intro replay as an admin tool

> Execution: `refdocs/execution/2026-10-22-admin-role.md`. Scope source: the author's request: the intro and tour should be replayable by an admin from Settings, for testing; "a simple admin access system (role based access)"; give it to her own seeded account and show her name instead of Amir's.

## 1. Why this exists

The intro and tour (D-53) now replay for everyone from Settings. For the UAT that is wrong: a tester who replays it mid-session is noise in the observations, and the author needs a way to show the onboarding to supervisors and examiners on demand. A role gives one place to say who may use author-only tools, and room for more later without rewriting login.

## 2. What's already covered

- Every request loads the user from the database by id (`current_user` in `app/api/deps.py`), so a role stored there is read fresh each time: revoking admin takes effect at once and nothing about it is baked into the token.
- The session stored in the browser already carries the user object; the sign-in and `/api/auth/me` return it.
- Accounts are created only by the author's seed scripts (D-03); there is no sign-up (D-54), so nobody can give themselves a role.

## 3. Scope

**In**
1. **Migration `0003_user_roles.sql`**: `users.role text not null default 'user' check (role in ('user','admin'))`, applied by the author in the Supabase SQL editor like 0001 and 0002.
2. **Backend:** `role` on `UserOut` (so on sign-in and `/api/auth/me`), read from the row with a default of `"user"` so the app keeps working before the migration is applied; a `require_admin` dependency that answers 403 `forbidden` to anyone else (the one place future admin-only routes are gated); `users.set_role` / `users.set_display_name`; `scripts/set_role.py` (`--username`, `--role`, optional `--display`) and `--role` on `seed_users.py`.
3. **Frontend:** the session keeps `role` (an older stored session without it counts as `"user"`); Settings gets an **Admin** card, shown only to an admin, holding **Show the intro again** (moved out of "Other", so a tester no longer sees it); the card says it is for testing.
4. **The author's account:** after the migration, `uv run python scripts/set_role.py --username <your-username> --role admin --display Farah`. Her sign-in username changes only if she passes `--new-username` (she chose `admin`); the old one then stops working. A session already open keeps working, because it names the person's id, not the username.

**Out**
- Any screen for managing roles, more than two roles, per-feature permissions, or hiding data from an admin. An admin sees only their own data, like everyone (D-03).
- Changing a *tester's* username (it is the credential they were given). The author's own is changed by her, with `--new-username`, below.
- Running anything against the real database from here: the author applies the migration and runs the script.

## 4. Design

- The role is **authorisation data on the user row**, never taken from the request or the token. The browser's copy only decides what to *show*; the server's `require_admin` is what *enforces*. Today the replay is entirely in the browser (it clears two local flags), so hiding the button is the only gate it has and it protects no data; the dependency exists so the first admin route that does need protecting cannot be written without it.
- A role the browser has never heard of (a later `"auditor"`) must not break sign-in: the session stores the role as given and the UI treats only the exact string `"admin"` as admin.

## 5. Risks

- **The migration is not applied yet.** Until it is, everyone reads as `"user"`: the app works, but no one sees the Admin card. The script fails with a clear message about the missing column instead of changing nothing silently.
- **Someone assumes the hidden button is security.** Mitigation: the plan, the ADR and the code comment say it is not; any admin data route must use `require_admin`.
- **Role changes need a fresh sign-in to show in the browser**, because the session holds a copy. The server side is immediate.
