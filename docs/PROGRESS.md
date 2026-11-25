# VoxCare engineering progress

Single source for roadmap, status, decisions, blockers and session handoff. Update after every milestone.

- **Requirements:** [voxcare_build_prompt.md](../voxcare_build_prompt.md) (hackathon spec). Pitch: the VoxCare PDF (Android long-term plan).
- **Branch:** work on `dev` (tracks `origin/dev`). PR target: `main`. Never touch `main`, force-push, merge or deploy without approval.
- **Time budget:** 3 h 30 total, started 2026-11-25 12:10 WAT. Last 30 min reserved for verification, docs and PR.
- **Rules:** a regression test with every fix; tests use dummy keys and mocks only (see README "Tests"); no dependency upgrades without approval; never expose `.env` values.

## Status key

Done (verified) · Partial · In progress · Next · Blocked (needs decision) · Deferred (out of time, still required) · Optional

## Roadmap

| ID | Task | Priority | Status |
|---|---|---|---|
| T0 | Safe test foundation (network guard, Supabase fake, dummy env, resets) | Mandatory | **Done** `fa32bbc` |
| T1 | Doctor login brute-force protection (S1) | Mandatory | **Partial** `76f367a`: rate limits, spoof-resistant client key, demo PIN refused in prod. Full fix needs D1 |
| T2 | Help-person join link: **expiring and atomically consumed** (S2) | Mandatory | Next |
| T3 | Per-IP abuse limits: patient create, briefing, join, alert (S3) | Mandatory | To do |
| T4 | Generic 500s, CORS localhost dev-only, test-email off in prod (S7, S9, S10) | Mandatory | To do |
| T5 | Separate `SESSION_SECRET` (S8) | Optional | To do (needs new env var: approval) |
| T6 | **Meaningful patient authorisation** for doctor access, not just a doctor-created record (S4) | Mandatory | Blocked: D3 |
| T7 | Delete my card / revoke emergency link (S5, "Delete anytime") | Needs approval | Blocked: D2 |
| T8 | Verified facts: validation, **atomic updates, partial-failure handling** (C2) | Mandatory | To do (atomicity may need a Postgres function: migration approval) |
| T9 | EndVisit save errors visible + retry (C1) | Mandatory | To do |
| T10 | Test that both briefingText copies match (C5) | Mandatory | To do |
| T11 | Timeouts on Brevo and YarnGPT calls | Mandatory | To do |
| T12 | Alert rate-limit race + location validation (S6) | Optional | To do |
| T13 | Remove duplicate briefing trigger (C6) | Optional | To do |
| T14 | Termii SMS alerts (spec §9; code sends email) | Needs approval | Blocked: D4 |
| T15 | Document changed setup "Check" step | Needs approval | To do |
| T16 | Offline cache for briefing audio + emergency data (C3), **with care for sensitive medical data in caches, expiry and revocation** | Mandatory | To do |
| T17 | Handler tests for every endpoint (incl. emergency never returns transcripts) | Mandatory | Ongoing with each fix |
| T18 | Server tests (export handler from server/index.ts) | Optional | To do |
| T19 | Playwright end-to-end tests | Optional | To do (new dependency: approval) |
| T20 | CI on **pull requests into `main`** (test, lint, build, backend type check) | Optional | To do |
| T21 | Coverage reporting | Optional | To do (new dependency: approval) |
| T22 | Backend type check in `npm run build` (C4) | Mandatory | To do |
| T23 | Remove `@vercel/node` (types only; clears 7 audit findings) | Needs approval | To do |
| T24 | vite-plugin-pwa audit findings (build-time; only "fix" is a downgrade) | Optional | Accepted, monitor |
| T25 | `MotionConfig reducedMotion="user"` | Mandatory | To do |
| T26 | Consent picture cards that are buttons with no action | Mandatory | To do |
| T27 | Lighthouse + axe at 375/820/1180/1440 px | Mandatory | To do |

## Decisions

- 2026-11-25: In-memory rate limiting, single Render instance (no new dependency or schema). Documented in README "Doctor sign-in".
- 2026-11-25: `X-Forwarded-For` trusted only from a private peer, last entry only. Unverified on Render (see B1).
- 2026-11-25: Wrong PIN keeps returning `200 {doctor:null}` to avoid frontend changes.
- 2026-11-25: Spec deviations kept as built (email instead of SMS; join link instead of "Check" tick/cross; React 19).

## Open decisions (need the team)

- **D1** Doctor sign-in with MDCN number + 6-digit PIN, scrypt hash, per-doctor lockout columns (schema migration + login screen change). Needed to fully close S1.
- **D2** Build "Delete my card" (T7)?
- **D3** How the patient authorises a doctor in T6 (e.g. confirm on the patient's own phone, or a code shown on the patient's card).
- **D4** Termii SMS vs email for family alerts (T14); needs Termii key and sender ID.

## Blockers and deploy requirements

- **B1** After deploy: 5 wrong PINs from one phone, Render log must show `source: 'forwarded'`. If `socket`, all users share one limit: fix before relying on it.
- **B2** Before deploy: set a private PIN for the seeded doctor (SQL in README), or live demo sign-in fails.

## Verification log

| When | Commit | Tests | Lint | Types (app / api) | Build |
|---|---|---|---|---|---|
| Baseline | `92fd4c7` | 35/35 | ok | ok / ok | ok |
| T0 | `fa32bbc` | 53/53 | ok | ok / ok | ok |
| T1 | `76f367a` | 116/116 | ok | ok / ok | ok |

## Handoff

- **Completed:** T0, T1 (partial, see D1). Pushed to `origin/dev`.
- **Exact next action:** T2: make `/api/join` links expire (from `patients.created_at`) and single-use via one conditional update (`help_confirmed_at is null`), plus a token-protected "new link" action; regression tests in `api/join.test.ts`.
