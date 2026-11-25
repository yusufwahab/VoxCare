# Blockers, deploy warnings and open security issues

## Deploy warnings (do not deploy without these)

- **W1** Set a private PIN for the seeded doctor before deploying (SQL in README "Doctor sign-in"). Production refuses `1234`, so the live demo sign-in fails otherwise.
- **W2** Keep `NODE_ENV=production` on Render, or `1234` is accepted again.
- **W3** Run exactly one Render instance (rate limits are in memory).
- **W4** After deploy: enter 5 wrong PINs from one phone; Render logs must show `[doctor-login] rate limited { scope: 'client', source: 'forwarded' }`. If `source: 'socket'`, all users share one limit: fix before relying on it.
- **W5** With `DEMO_MODE=true`, the demo teammate's phone number is visible in the deployed site's code (by design).

## Open security issues

| ID | Severity | Issue | Status |
|---|---|---|---|
| S1 | High | Doctor PIN brute force (4-digit, PIN-only, unsalted SHA-256) | **Partially mitigated** (T1). Global limit can block all doctors for 15 min; counts reset on restart. Full fix: D1 |
| S2 | High | Join link never expires and can be reused, so alerts and location can be redirected | **Fixed** (T2): single-use, atomic, 72 h expiry, token-protected replacement. Join tokens are still stored in plain text (lookup by value); hashing them is a possible follow-up |
| S3 | Med-High | No abuse limits; unauthenticated patient creation runs paid YarnGPT jobs | Open: T3 |
| S4 | Medium | Doctor access to patients not authorised on the server | Open: T6, blocked on D3 |
| S5 | Medium | Emergency URL is a permanent key with no revocation | Open: T7, blocked on D2 |
| S6 | Low | Alert rate-limit race; client-chosen location | Open: T12 |
| S7 | Low | 500 errors return internal messages | Open: T4 |
| S8 | Low | Sessions signed with the service role key; no revocation | Open: T5 |
| S9 | Low | CORS allows `http://localhost:*` in production | Open: T4 |
| S10 | Low | `/api/test-email` guarded only by `NODE_ENV` | Open: T4 |

## Open correctness issues

C1 EndVisit stuck on "Saving" (T9) · C2 verify ignores database errors and fact types (T8) · C3 offline cache likely misses cross-origin audio and API (T16) · C4 build skips backend type check (T22) · C5 duplicated briefing text (T10) · C6 duplicate briefing trigger (T13).

## Known limitations

- An expired join link is only renewed while the patient is on the setup Check screen. A patient who skipped that step has no button to resend later (no UI for it yet).
- Once a help person has joined, the patient cannot change them (re-invite is refused). Changing help person needs a UI flow and a decision.

- Test network guard does not cover DNS, UDP, child processes or worker threads.
- No browser (jsdom) test environment, so UI changes are verified by type check and lint only.
- `server/index.ts` starts listening on import, so it has no tests yet (T18).
