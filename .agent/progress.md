# Progress

## Time budget

3 h 30 total, started 2026-11-25 12:10 WAT, so the budget ends at **15:40 WAT**. The last 30 minutes (from 15:10) are for final verification, docs and PR preparation. Timebox each milestone (see roadmap "Planned order").

## Commits on `dev`

| Commit | Type | Summary |
|---|---|---|
| `92fd4c7` | baseline | Collaborator's split of backend (Render) and frontend (Vercel) |
| `fa32bbc` | test | Safe test foundation (T0) |
| `76f367a` | fix(auth) | Rate-limited doctor login, demo PIN refused in production (T1, partial) |
| `47a09ec` | docs | First progress tracker (replaced by `.agent/`) |
| `8b70c7d` | docs | AGENTS.md and `.agent/` records |
| `dd9e5ac` | fix(join) | Single-use, atomic, expiring join links; device-token re-invite (T2, S2) |
| `9942591` | docs | T2 hash in progress and roadmap |
| `41b3d5d` | security | Generic 5xx, log hygiene, production CORS, test-email off, testable server (T4, T18) |
| `4ebae50` | security | Per-endpoint abuse limits with Retry-After (T3) |
| `867f6e6` | docs | Progress and handoff after T3/T4 |
| `76359ed` | fix | Validate medical records before saving (T8, partial). Body says 27 tests; it is 37 |
| `d057bf2` | fix | Handle failed medical record saves (T9) |
| `392a21d` | fix | Emergency alert reliability (T12) |
| `8f95a80` | build | Backend type check in the build (T22) |
| `e6e63b9` | docs | Progress and handoff after T8/T9 |
| `edf2808` | build | Fix: backend type check skipped on Vercel (would have broken every frontend deploy) |
| `e3b8303` | fix | Timeouts on Brevo and YarnGPT (T11) |
| `2c98454` | refactor | One shared briefing text (T10) |
| `52fc8a6` | fix | No duplicate briefing requests (T13) |
| `a0465d3` | a11y | Reduced motion, non-interactive consent pictures (T25, T26) |
| `3111dd0`…`825242a` | docs | Progress, handoff, production checks, B1 (main moved) |
| `e8e6b95` | fix | Fix offline emergency card access (T16) |
| `5c72183` | ci | Add automatic checks for pull requests (T20) |
| `b0d334d` | test | Improve API test coverage: emergency and facts endpoints (T17) |
| `1f0201d` | test | Add accessibility checks (T27, static part) |
| `b621077` | docs | Document outstanding project requirements (T15) |
| `d32f172` | merge | Merge main into dev (B1). Backup branch `backup/dev-before-main-merge` |
| `e9d6092` | fix | Label saved emergency information when offline |
| `fc9fd06` | a11y | Improve screen reader labels (axe) |

Session 4 (2026-11-25 13:15 WAT): from here on, commits carry no AI co-author trailer (user setting `attribution.commit = ""`).

**Push blocked (session 4):** `git fetch` and `git push` to github.com fail again with "Connection was reset". The user reports earlier commits reached `origin/dev` (the local tracking ref could not be refreshed, so `git status` still shows it as behind). Session 4 commits are local only until `git push origin dev` succeeds.

## Verification log

| State | Tests | Lint | Types app / api | Build | Notes |
|---|---|---|---|---|---|
| Baseline `92fd4c7` | 35/35 | ok | ok / ok | ok | Prod deps 0 vulns; dev deps 11 (4 high), build-time only |
| T0 `fa32bbc` | 53/53 | ok | ok / ok | ok | Checked on its own before push |
| T1 `76f367a` | 116/116 | ok | ok / ok | ok | 24 of 36 new login tests fail on the old code. Build: no keys, no test code |
| T2 `dd9e5ac` | 150/150 | ok | ok / ok | ok | 21 of 34 new join tests fail on the old code. Build: no keys |
| T4 `41b3d5d` | 173/173 | ok | ok / ok | n/a | Verified on its own in a temporary worktree |
| T3 `4ebae50` | 190/190 | ok | ok / ok | ok | Build: no keys |
| T11, T10, T13, T25, T26 `a0465d3` | 248/248 | ok | ok / ok | ok | `tsx` loads the shared briefing module. UI not browser-tested |
| T16 `e8e6b95` | 262/262 | ok | ok / ok | ok | 14 new offline tests (fake Cache Storage). Not browser-tested |
| T20 `5c72183` | 262/262 | ok | ok / ok | ok | CI steps run locally with the workflow's dummy env; build used the dummy API URL, not `.env` |
| T17, T27 `1f0201d` | 274/274 | ok | ok / ok | ok | Build: no keys (only base64 font data matched the scan) |
| Merge `d32f172` | 300/300 | ok | ok / ok | ok | +main's 19 reducer tests, +6 merge tests (verify close, join emailed, visit endpoints) |
| `fc9fd06` | 300/300 | ok | ok / ok | ok | Browser run below |
| T8, T9, T12, T22 `8f95a80` | 230/230 | ok | ok / ok | ok | A deliberate backend type error fails `npm run build` (exit 2). Commits checked on the final state, not one by one |

Test files: `test/networkGuard.test.ts` (13), `api/doctor-login.test.ts` (36), `api/_lib/clientIp.test.ts` (23), `api/_lib/rateLimit.test.ts` (5), `src/lib/api.test.ts` (4), plus the original `src/lib/sentence.test.ts` (31) and `api/email.test.ts` (4), `api/join.test.ts` (34), `api/security.test.ts` (10), `server/app.test.ts` (13), `api/limits.test.ts` (20), `api/verify.test.ts` (37), `api/timeouts.test.ts` (6), `api/briefingRuns.test.ts` (4), `shared/briefingText.test.ts` (3), `src/components/ui.test.tsx` (2), `src/lib/api.test.ts` (+3), `src/lib/offline.test.ts` (14), `api/endpoints.test.ts` (9), `test/a11y.test.ts` (3).

## Browser verification (session 5)

Headless Microsoft Edge (puppeteer-core, axe-core, Lighthouse installed in a scratch folder, not the project) against the production build pointed at a local mock API on 127.0.0.1. No real Supabase, Brevo or YarnGPT. Not a real phone.

| Check | Result |
|---|---|
| 375 / 820 / 1180 / 1440 px: `/`, `/start`, `/home`, `/card`, `/e/:id`, `/hospital`, `/v` | No horizontal overflow; screenshots reviewed by script only |
| Hospital: PIN, demo patient, one device, Allow, teach clip, practice tap, Pain, knee pin ("Right knee"), Sharp, Very bad, 3 days | Sentence "I have a sharp pain in my right knee. It is very bad. It started 3 days ago." |
| End visit: verify facts, confirm self-reported, save fails once | "Not saved. Something went wrong. Please try again." + "Try again"; retry shows "Visit saved"; 2 server calls |
| Emergency, alert ok / alert fails | "Family has been emailed." / "Could not email family. Please call them now." |
| Play briefing | 4 languages queued; plays from the saved copy (blob URL) |
| Offline, own phone (after Home online) | Facts and audio work; "Saved on this phone on <date>. No connection…"; cache holds the card JSON + 4 audio files only |
| Offline, card not saved / responder phone | "No connection"; responder phone has no `vc-offline-card-v1` |
| Reduced motion | 0 running animations with reduce, 3 without |
| axe (375, 1180) | Fixed ARIA and landmark issues; remaining: palette contrast, Home has no `h1`, one redundant alt |
| Lighthouse mobile | `/`: perf 49–79 (LCP ~5.5 s), a11y 96, best practices 100. `/e/:id`: perf 91, a11y 96, best practices 100 |

Not verified: physical NFC, camera QR scanning, real email delivery, real YarnGPT audio, two-device Realtime, device reset (there is no reset button in the UI; clearing site data removes the cache), iOS Safari.
