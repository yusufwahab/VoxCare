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

## Verification log

| State | Tests | Lint | Types app / api | Build | Notes |
|---|---|---|---|---|---|
| Baseline `92fd4c7` | 35/35 | ok | ok / ok | ok | Prod deps 0 vulns; dev deps 11 (4 high), build-time only |
| T0 `fa32bbc` | 53/53 | ok | ok / ok | ok | Checked on its own before push |
| T1 `76f367a` | 116/116 | ok | ok / ok | ok | 24 of 36 new login tests fail on the old code. Build: no keys, no test code |
| T2 `dd9e5ac` | 150/150 | ok | ok / ok | ok | 21 of 34 new join tests fail on the old code. Build: no keys |
| T4 `41b3d5d` | 173/173 | ok | ok / ok | n/a | Verified on its own in a temporary worktree |
| T3 `4ebae50` | 190/190 | ok | ok / ok | ok | Build: no keys |

Test files: `test/networkGuard.test.ts` (13), `api/doctor-login.test.ts` (36), `api/_lib/clientIp.test.ts` (23), `api/_lib/rateLimit.test.ts` (5), `src/lib/api.test.ts` (4), plus the original `src/lib/sentence.test.ts` (31) and `api/email.test.ts` (4), `api/join.test.ts` (34), `api/security.test.ts` (10), `server/app.test.ts` (13), `api/limits.test.ts` (17).
