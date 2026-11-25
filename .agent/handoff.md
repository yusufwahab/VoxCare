# Handoff (start here)

Last updated: 2026-11-25 12:20 WAT, session 2 (after T2).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`, in sync with `origin/dev`. PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); docs `47a09ec`, `8b70c7d`; T2 join links (S2 fixed, see progress.md).
- **Verification:** 150/150 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## Exact next action

**T2 is done.** Join links: `api/_lib/invite.ts` (token format, 72 h TTL), `api/join.ts` (atomic consume, `action: "reinvite"` with the device token), `src/pages/setup/Check.tsx` (renews an expired link). Tests in `api/join.test.ts`.

**Recommended next milestone: T4 + T3 for the public API (timebox 45 min).**

1. T4: in `api/_lib/http.ts` `route()`, return `"Server error"` for any 5xx that is not an intentional `HttpError` message (log the real one by path only); CORS in `server/index.ts` allows `localhost` only when not production; `/api/test-email` returns 404 when `isProduction()`.
2. T3: reuse `api/_lib/rateLimit.ts` (from T1) with `clientIp` for `POST /api/patient` (paid YarnGPT jobs), `POST /api/join`, `POST /api/briefing` and `POST /api/alert`. 429 with `Retry-After`. Same in-memory, single-instance limits (W3).
3. Tests: each limited endpoint returns 429 after the limit; a DB error returns a generic 500 with no internal text; CORS rejects localhost in production.

Then: T8 + T9 → T11 → T22 + T25 + T26, then T16 if time remains. After each: verify, commit, push, update `.agent/progress.md` and `roadmap.md`.
