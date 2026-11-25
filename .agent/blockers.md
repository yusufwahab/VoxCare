# Blockers, deploy warnings and open security issues

## Deploy warnings (do not deploy without these)

- **W1** Set a private PIN for the seeded doctor before deploying (SQL in README "Doctor sign-in"). Production refuses `1234`, so the live demo sign-in fails otherwise.
- **W2** Keep `NODE_ENV=production` on Render, or `1234` is accepted again.
- **W3** Run exactly one Render instance (rate limits are in memory).
- **W4** After deploy: enter 5 wrong PINs from one phone; Render logs must show `[doctor-login] rate limited { scope: 'client', source: 'forwarded' }`. If `source: 'socket'`, all users share one limit: fix before relying on it.
- **W6** CORS allows only `FRONTEND_URL` origins in production. Add a custom domain or preview URL there (comma separated) or the browser blocks it.
- **W7** If every user gets 429 at once, Render is not passing the client address (see W4): all users share one limit.
- **W8** `npm run build` runs `npm run typecheck`. On Vercel the backend part is skipped (no `api/` upload) and Vercel must install devDependencies (default). Render's build (`npm install`, production) does not type-check; the check happens locally and should run in CI (T20).
- **W9 Pushing `dev` (not verified: dashboards not visible from here).** The repo has no CI workflows and no `render.yaml`, so deploys come only from the Vercel and Render Git integrations. Before the first push, the owner (yusufwahab) should check:
  - **Render:** Settings, Build & Deploy: "Branch" must be `main` (or auto-deploy off). If it is `dev`, the push deploys these commits to the **production API**.
  - **Vercel:** a push to `dev` creates a Preview deployment by default. Check which `VITE_API_URL` the Preview environment uses. If it is the production Render URL, the preview frontend talks to production; the browser blocks it only because CORS allows `FRONTEND_URL` alone (old and new code). Best: a separate Render + Supabase project for previews, or disable previews for `dev` (Settings, Git, Ignored Build Step).
  - Supabase has no Git integration here, so pushes never touch the database.
- **W10 Local development writes to production.** `vite.config.ts` loads `.env` into the dev server, and `.env` holds the production `SUPABASE_URL` and service role key (names checked, values not printed). Running `npm run dev` and creating a patient or saving a visit writes to production and can send real Brevo emails and paid YarnGPT jobs. Use a separate Supabase project in `.env` for development. Tests are safe: they refuse to run unless every key is a dummy (`test/setup.ts`).
- **W5** With `DEMO_MODE=true`, the demo teammate's phone number is visible in the deployed site's code (by design).

## Open security issues

| ID | Severity | Issue | Status |
|---|---|---|---|
| S1 | High | Doctor PIN brute force (4-digit, PIN-only, unsalted SHA-256) | **Partially mitigated** (T1). Global limit can block all doctors for 15 min; counts reset on restart. Full fix: D1 |
| S2 | High | Join link never expires and can be reused, so alerts and location can be redirected | **Fixed** (T2): single-use, atomic, 72 h expiry, token-protected replacement. Join tokens are still stored in plain text (lookup by value); hashing them is a possible follow-up |
| S3 | Med-High | No abuse limits; unauthenticated patient creation runs paid YarnGPT jobs | **Mitigated** (T3): per-client and global limits. In memory, single instance; many addresses can still use the global cap (blocks sign-up for up to 1 h) |
| S4 | Medium | Doctor access to patients not authorised on the server | Open: T6, blocked on D3 |
| S5 | Medium | Emergency URL is a permanent key with no revocation | Open: T7, blocked on D2 |
| S6 | Low | Alert rate-limit race; client-chosen location | **Fixed** for one instance (T3, T12). Location is range-checked but still client-chosen (cannot be verified) |
| S7 | Low | 500 errors return internal messages | **Fixed** (T4) |
| S8 | Low | Sessions signed with the service role key; no revocation | Open: T5 |
| S9 | Low | CORS allows `http://localhost:*` in production | **Fixed** (T4). CORS is not authentication: non-browser clients can still call the API |
| S10 | Low | `/api/test-email` guarded only by `NODE_ENV` | **Fixed** (T4): not routed in production (`NODE_ENV` or `VERCEL_ENV`) and the handler refuses too |

## Open correctness issues

C1 fixed (T9) · C2 **partially** fixed (T8): validated and retry-safe, but a failure mid-save leaves some facts written until the doctor retries; two server instances could still duplicate a fact (no unique index) · C3 offline cache likely misses cross-origin audio and API (T16) · C4 fixed (T22) · C5 fixed (T10) · C6 fixed (T13).

## Known limitations

- No browser or device tests: EndVisit error/retry (T9), reduced motion (T25) and the consent cards (T26) are verified by type check, lint and server-render tests only. Check on a phone before the demo.
- Briefing jobs are merged per patient in one process only (like the rate limits).

- An expired join link is only renewed while the patient is on the setup Check screen. A patient who skipped that step has no button to resend later (no UI for it yet).
- Once a help person has joined, the patient cannot change them (re-invite is refused). Changing help person needs a UI flow and a decision.

- Test network guard does not cover DNS, UDP, child processes or worker threads.
- No browser (jsdom) test environment, so UI changes are verified by type check and lint only.
- The emergency page and patient lookup (`GET`) are not rate limited by design; they rely on unguessable UUIDs (S5).
- A failed alert email releases the per-patient count; if the email was sent but the database insert failed, a retry can send a second email.
