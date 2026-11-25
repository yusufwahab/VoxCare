# Roadmap (T0–T27)

Status: **Done** · **Partial** · **Next** · To do · Blocked (decision) · Deferred (still required) · Optional. Never remove a task.
Security IDs (S1–S10) and code issues (C1–C6) are described in [blockers.md](blockers.md).

| ID | Task | Priority | Status |
|---|---|---|---|
| T0 | Safe test foundation: network guard, Supabase fake, dummy env, resets | Mandatory | **Done** `fa32bbc` |
| T1 | Doctor login brute-force protection (S1) | Mandatory | **Partial** `76f367a`. Remaining work deferred: D1 |
| T2 | Help-person join link: **expiring and atomically consumed**, token-protected re-invite (S2) | Mandatory | **Done** `dd9e5ac` |
| T3 | Per-client abuse limits: patient create, briefing, join, alert (S3) | Mandatory | To do |
| T4 | Generic 500s; localhost CORS only outside production; test-email off in production (S7, S9, S10) | Mandatory | To do |
| T5 | Separate `SESSION_SECRET` for session signing (S8) | Optional | To do (new env var: approval) |
| T6 | **Meaningful patient authorisation** for doctor access, not just a doctor-created record (S4) | Mandatory | Blocked: D3 |
| T7 | Delete my card, revoke emergency link (S5, "Delete anytime") | Needs approval | Blocked: D2 |
| T8 | Verified facts: validation, **atomic updates, partial database failures** (C2) | Mandatory | To do. Full atomicity needs a Postgres function (migration approval) |
| T9 | EndVisit: visible save errors and retry (C1) | Mandatory | To do |
| T10 | Test that the two `briefingText` copies stay identical (C5) | Mandatory | To do |
| T11 | Timeouts on Brevo and YarnGPT calls (emergency banner can hang) | Mandatory | To do |
| T12 | Alert rate-limit race, location range validation (S6) | Optional | To do |
| T13 | Remove duplicate briefing trigger after setup (C6) | Optional | To do |
| T14 | Termii SMS alerts (spec §9; code sends email) | Needs approval | Blocked: D4 |
| T15 | Document the changed setup "Check" step | Needs approval | To do |
| T16 | Offline cache for briefing audio and emergency data (C3), **handling sensitive medical data in caches, expiry and revocation** | Mandatory | To do |
| T17 | Handler tests for every endpoint (incl. emergency never returns transcripts) | Mandatory | Ongoing with each fix |
| T18 | Server tests (export the handler from `server/index.ts`) | Optional | To do |
| T19 | Playwright end-to-end tests | Optional | To do (new dependency: approval) |
| T20 | CI on **pull requests into `main`**: test, lint, build, backend type check | Optional | To do |
| T21 | Coverage reporting (`@vitest/coverage-v8`) | Optional | To do (new dependency: approval) |
| T22 | Backend type check inside `npm run build` (C4) | Mandatory | To do |
| T23 | Remove `@vercel/node` (types only; clears 7 dev audit findings) | Needs approval | To do |
| T24 | vite-plugin-pwa dev audit findings (only offered fix is a downgrade) | Optional | Accepted, monitor |
| T25 | `MotionConfig reducedMotion="user"` (spec §10) | Mandatory | To do |
| T26 | Consent picture cards are focusable buttons with no action | Mandatory | To do |
| T27 | Lighthouse + axe at 375 / 820 / 1180 / 1440 px | Mandatory | To do |

## Deferred security work for S1 (from T1, pending team approval: D1)

- Sign-in with MDCN number + longer PIN (login screen change).
- Salted slow PIN hash (scrypt, built into Node) with a migration from the current unsalted SHA-256.
- Persistent per-doctor lockout and rate limits (database columns), which also removes the global-limit DoS trade-off and the single-instance limit.

## Planned order for the remaining budget

~~T2~~ → T8 + T9 → T11 → T4 → T3 → T22 + T25 + T26 → T16 (if time) → final verification and PR description.
