# WordBomb

WordBomb is a browser-based multiplayer word game in the style of BombParty. Players in a room pass a bomb around. Whoever holds it has to type a dictionary word containing the current prompt, such as `ING`, before the fuse runs out. The fuse length is hidden and random and keeps burning as the bomb is passed, so every turn is a hot potato. No accounts, no install: open a link, pick a name, play. The server owns every rule and timer; clients send intents and render snapshots.

Play it at https://wordbomb-4n1h.onrender.com. It runs on a free Render instance, so the first load after a quiet spell can take about a minute while the server wakes up.

## Features

- Rooms with a 6-character code and shareable link, private by default with an optional public listing on the home page
- Classic mode: shuffled seating, 2 and 3 letter prompts drawn from the dictionary, hidden-fuse bomb with a guaranteed minimum turn, lives, elimination, winner
- Alphabet bonus: use every letter A to Z across your accepted words to earn a life back
- Host-configurable settings in the lobby: max players, lives, bomb timing, minimum word length, prompt difficulty, alphabet bonus
- Live typing previews, rejection reasons, recent words and a per-player letter tracker
- Reconnect after a refresh or dropped connection into the same seat while the game keeps running
- Late joiners spectate the live game and are seated for the next round; anyone can sit out a round
- Lobby and in-game chat with rate limiting, host auto-transfer, play again in the same room
- Animated bomb with fuse spark and explosion burst, per-player feedback, winner confetti, synthesized sound effects with volume and mute, dark theme, phone layout, reduced-motion support
- ENABLE word list (about 172k words) with a small blocklist, loaded into memory with a precomputed prompt index

## Architecture

pnpm monorepo, TypeScript everywhere, no build step for the server (Node 24+ runs the TypeScript source directly).

| Package           | Role                                                                                                                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | Socket event contracts (zod schemas), settings bounds and defaults, snapshot types. Consumed as TypeScript source.                                                                                                                                                                                                           |
| `apps/server`     | Express + Socket.IO. `src/engine` is the pure game state machine with injected clock and rng. `src/dictionary` loads the word list and builds the prompt index. `src/rooms` holds the room model, host transfer, reconnect tokens, explosion timers, rate limits and socket handlers. Serves the built client in production. |
| `apps/web`        | Vite + React 19 + Tailwind v4 client. A small socket store turns server snapshots into React state; Motion drives animations and the Web Audio API synthesizes the sounds.                                                                                                                                                   |
| `e2e`             | Playwright smoke test with two browser contexts playing a round against a production build.                                                                                                                                                                                                                                  |

The server broadcasts a full sanitized room snapshot after every change. Short-lived events (`word:accepted`, `bomb:exploded`, and so on) only drive animations and sounds, so a client that misses an event still renders correctly from the next snapshot. The client never learns when the bomb will explode; it renders fuse intensity from the bomb's age and the configured maximum.

## Prerequisites

- Node.js 24 or newer (developed on Node 26)
- pnpm 12 (`npm install -g pnpm`)
- Docker, only for building the production image

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the API and socket server on http://localhost:3000 and the Vite dev server on http://localhost:5173, which proxies `/socket.io` and `/api` to the server. Open http://localhost:5173 in two browser profiles or an incognito window to play against yourself.

## Scripts

| Command          | What it does                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`       | Server with file watching plus Vite dev server                                                                                   |
| `pnpm build`     | Builds the client into `apps/web/dist`                                                                                           |
| `pnpm start`     | Runs the production server, which serves the built client on port 3000 (`PORT` to override)                                      |
| `pnpm test`      | Vitest unit and integration tests across all packages                                                                            |
| `pnpm test:e2e`  | Playwright smoke tests (builds the client, starts a server on port 3100). Run `pnpm exec playwright install chromium` once first |
| `pnpm typecheck` | TypeScript across all packages                                                                                                   |
| `pnpm lint`      | ESLint and Prettier check. `pnpm format` rewrites files                                                                          |

## Deployment

The live instance is a Docker web service on Render's free tier built from this repo, with `/healthz` as the health check and no environment variables beyond the `PORT` Render sets. Free instances sleep after 15 minutes without traffic and lose their in-memory rooms, so a room that was open when the server went to sleep is gone when it wakes.

The Dockerfile builds the client and runs the server with production dependencies only:

```sh
docker build -t wordbomb .
docker run -p 3000:3000 wordbomb
```

`fly.toml` is set up for a single always-on machine on Fly.io, which keeps rooms alive between visits. With `flyctl` installed and logged in:

```sh
fly launch --copy-config --no-deploy
fly deploy
```

Rooms live in memory in a single process, so run exactly one instance. The server reads `x-forwarded-for` for per-IP rate limits, which Render and Fly both set.

## Game rules

1. The host starts with at least two seated players. Seats are shuffled.
2. The holder types a word containing the prompt. Accepted words pass the bomb and draw a new prompt. Rejected words show why and can be retried.
3. A bomb lives for a random time inside the configured range and keeps burning as it is passed. Each new holder gets at least the minimum turn time before it can explode.
4. When it explodes the holder loses a life, a fresh bomb is lit and the turn passes. At zero lives you are out.
5. Completing the alphabet with your accepted words grants a life, up to the maximum.
6. The last player standing wins and the room returns to the lobby for another round.

## License

[MIT](LICENSE)
