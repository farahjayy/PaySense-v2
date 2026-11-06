-- PaySense v2 — migration 0004: the colour and icon a person gives a category (ADR D-64).
-- Apply once, after 0003, in the Supabase SQL editor (see migrations/README.md).
--
-- A row exists only when the person has chosen something; no row means the default look. It is
-- keyed by category name, not by a user_categories id, because the twelve built-in categories live
-- in code and a category typed in an imported spreadsheet has no user_categories row either.
-- `icon` and `colour` are keys from the allow-lists in app/domain/categories.py (the backend
-- validates them); NULL means the default for that part.
--
-- Same lock-down as every other table: row level security ON with NO policies, and no
-- anon/authenticated privileges. Only the backend (service key) reads or writes.

begin;

create table user_category_styles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    name text not null check (length(btrim(name)) between 1 and 40),
    icon text,
    colour text,
    created_at timestamptz not null default now()
);
-- "Gym" and "gym" are the same category for one person.
create unique index user_category_styles_user_name_key on user_category_styles (user_id, lower(name));

alter table user_category_styles enable row level security;
revoke all on user_category_styles from anon, authenticated;

commit;
