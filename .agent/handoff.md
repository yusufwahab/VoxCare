# Handoff (start here)

Last updated: 2026-11-25 13:05 WAT, session 3 (after T10, T11, T13, T25, T26).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`, in sync with `origin/dev`. PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); docs `47a09ec`, `8b70c7d`; T2 `dd9e5ac` (S2 fixed); T4 `41b3d5d` (S7, S9, S10 fixed; T18 done); T3 `4ebae50` (S3 mitigated); T8 `76359ed` (**partial**); T9 `d057bf2`; T12 `392a21d`; T22 `8f95a80` + `edf2808`; T11 `e3b8303`; T10 `2c98454`; T13 `52fc8a6`; T25 + T26 `a0465d3`.
- **Push blocked:** GitHub unreachable from this machine; `dev` is 14 commits ahead of `origin/dev`. First action: `git push origin dev`.
- **Verification:** 248/248 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4), list every frontend origin in `FRONTEND_URL` (W6), Vercel installs devDependencies (W8). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## Exact next action

1. `git push origin dev` (14 local commits). Never force.
2. **Team decisions:** P1 ([proposals/P1-atomic-visit-save.md](proposals/P1-atomic-visit-save.md)), P2/D3 (T6, below), D2 (T7), D4 (T14).

### Next session: offline, remaining requirements, final checks

**T16 offline (timebox 40 min, needs care with medical data).** Goal (spec): the emergency page and briefing audio work without signal on the patient's own phone.
- Today `vite.config.ts:60-65` already has runtime caching: `/api/emergency` (NetworkFirst, 4 s) and `/briefings/*.mp3` (CacheFirst). But in production both are **cross-origin** (Render API, Supabase storage), and Workbox applies a RegExp route to a cross-origin URL only if the pattern matches from the start of the full URL. These patterns do not, so offline the page most likely has no data (C3). Neither cache has an expiry.
- Smallest fix: match on the full URL with a function, e.g. `urlPattern: ({ url }) => url.origin === API_ORIGIN && url.pathname === '/api/emergency'` (API origin from `VITE_API_URL` at build time) and `url.pathname.startsWith('/storage/v1/object/public/briefings/')`; add `expiration` (7 days, small `maxEntries`) and `cacheableResponse: { statuses: [200] }` for the API. Never cache doctor endpoints (`/api/facts`, `/api/verify`) or transcripts.
- Sensitive data: the cache is readable by anyone holding the unlocked phone. Clear it when the card is deleted (T7, D2) and on `reset()` in `src/store/device.ts`. Document this.
- Verify with Chrome DevTools offline mode on a built preview (`npm run build && npx vite preview`); it cannot be unit-tested here.

**Remaining requirements:** T27 Lighthouse + axe at 375/820/1180/1440 px (manual, browser); T15 document the setup "Check" step change; T20 CI on PRs into `main` (test, lint, typecheck, build); optional T19/T21 need new dependencies (approval).

**Blocked on decisions:** T6 (D3/P2), T7 (D2), T14 (D4), P1, D1 (S1 full fix).

**Final verification before the PR:** `npx vitest run`, `npx eslint .`, `npm run typecheck`, `npm run build`; scan `dist` and the full diff for `.env` values; on a phone check the setup flow, join link, emergency page + alert, EndVisit error and retry (stop the API to force one), and reduce motion; walk W1–W8 in [blockers.md](blockers.md); write the PR description into `main` (do not merge).

### Reference

**T8 state:** validated, every DB error reported, retry-safe, not atomic (P1).

**T6 recommendation (P2, not started, blocked on D3):** today the doctor's own phone taps "Allow", and any signed-in doctor with a patient id (it is in the public card QR) can read and change facts. Smallest real patient authorisation, no schema change:
- On the patient's phone (it holds the device token), a "Show to doctor" button calls `POST /api/visit-grant {patientId, token}` and shows a 6-digit code valid 10 min.
- The doctor enters the code; the server checks it (single use, in memory like the limits, 5 tries) and returns a signed grant `doctorId.patientId.exp` (HMAC, 2 h).
- `GET /api/facts` and `POST /api/verify` require that grant for that patient. The emergency page stays open (it is for responders).
- Not acceptable: a consent record the doctor creates, or treating the card QR as consent.
