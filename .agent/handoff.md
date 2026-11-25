# Handoff (start here)

Last updated: 2026-11-25, end of session 1.

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`, in sync with `origin/dev`. PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); progress docs `47a09ec` and the `.agent/` docs commit after it.
- **Verification:** 116/116 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## Exact next action

**T2, timebox 30 min.** In `api/join.ts`:

1. Expire join links after a fixed period from `patients.created_at` (no schema change).
2. Consume atomically: a single update with `help_confirmed_at is null` in the filter, returning the row; 0 rows means 409 "already joined". Never overwrite `help_email` once confirmed.
3. Add a re-invite action that issues a new `help_join_token` only with the patient's device token (`token_hash`).
4. Regression tests in `api/join.test.ts` using `invoke()` and `testDb` (expiry with fake timers, double join, concurrent joins, wrong or missing device token, bad email, database failure). Update `src/pages/Join.tsx` messages if needed.

**Then, focused API hardening:** T8 + T9 → T11 → T4 → T3 → T22 + T25 + T26, then T16 if time remains. After each: verify, commit, push, update `.agent/progress.md` and `roadmap.md`.
