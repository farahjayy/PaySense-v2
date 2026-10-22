-- 0003: a simple role on each user (ADR D-56). Apply once, in the Supabase SQL editor.
--
-- 'user' is everyone; 'admin' may use author-only tools (today: replaying the intro and tour from
-- Settings). The role is read from this column on every request, never from the login token, so
-- changing it takes effect on the person's next call. Nobody can set their own role: accounts are
-- created and changed only by the author's scripts (backend/scripts/set_role.py).
alter table users
    add column role text not null default 'user' check (role in ('user', 'admin'));
