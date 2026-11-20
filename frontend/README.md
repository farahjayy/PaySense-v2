# PaySense v2: frontend

The web app: Next.js (App Router), TypeScript in strict mode, Tailwind 4, Recharts, TanStack Query and zod. It talks to the FastAPI backend only through the HTTP API, and the API types are generated from the backend's OpenAPI document. It cannot reach the database or compute a score itself.

Needs Node.js 20 or newer (developed on 24). The full setup for both servers is in [`../SETUP.md`](../SETUP.md).

## Run it

```bash
cp .env.example .env.local   # then fill it in; see ../refdocs/guides/env_setup.md
npm install
npm run dev                  # http://localhost:3000 (the backend must be running)
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest); `npm run test:cov` adds coverage |
| `npm run e2e` | Playwright tests (desktop and phone viewports) |
| `npm run gen:api` | Regenerate `lib/api/schema.d.ts` from the backend's OpenAPI document. Run it after any backend route or schema change; `npm run check:api` fails if the committed file is out of date |

## Layout

```
app/          routes: welcome, login, and the signed-in shell
components/   UI components
lib/          session, API client and generated schema.d.ts, Content-Security-Policy builder
scripts/      api-types.mjs (the type generator)
tests/        unit/ and e2e/
proxy.ts      gives each page request its own script nonce and the matching Content-Security-Policy
```

## A note on Next.js

This project uses a newer Next.js major version than most online documentation covers. `AGENTS.md` points to the documentation bundled in `node_modules/next/dist/docs/`; read that before relying on older examples.
