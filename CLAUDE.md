# WordBomb

Browser-based multiplayer word game (BombParty style). pnpm monorepo, TypeScript everywhere.

## Layout

- `packages/shared`: event contracts (zod), settings defaults, shared types. Exported as TS source, no build.
- `apps/server`: Express + Socket.IO. Runs directly on Node (native type stripping), no build step.
  - `src/engine`: pure game logic, no IO or timers.
  - `src/dictionary`: ENABLE loader, blocklist, prompt index.
  - `src/rooms`: room manager, socket handlers, game runner timers.
- `apps/web`: Vite + React + Tailwind v4 client.
- `e2e`: Playwright smoke tests.

## Commands

- `pnpm install`
- `pnpm dev`: server on :3000 (node --watch) and Vite on :5173 (proxies /socket.io and /api).
- `pnpm build`: builds the web client into `apps/web/dist`, which the server serves in production.
- `pnpm start`: production server, serves the built client.
- `pnpm test`: Vitest across all packages. `pnpm test:e2e` runs Playwright.
- `pnpm typecheck`, `pnpm lint`, `pnpm format`.

## Conventions

- Relative imports in `packages/shared` and `apps/server` use explicit `.ts` extensions (required by Node native TS).
- Only erasable TS syntax in shared and server (no enums, namespaces, parameter properties).
- Server is the source of truth. Clients send intents and render snapshots.
- Conventional single-line commits, no emojis, minimal comments.
