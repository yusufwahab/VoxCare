# Handoff (start here)

Last updated: 2026-11-25 12:40 WAT, session 2 (after T2, T3, T4).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`, in sync with `origin/dev`. PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); docs `47a09ec`, `8b70c7d`; T2 `dd9e5ac` (S2 fixed); T4 `41b3d5d` (S7, S9, S10 fixed; T18 done); T3 `4ebae50` (S3 mitigated, S6 race fixed for one instance).
- **Verification:** 190/190 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4), list every frontend origin in `FRONTEND_URL` (W6). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## Exact next action

**T2, T3 and T4 are done.** Limits in `api/_lib/limits.ts` (use `enforce()` from `rateLimit.ts` before the first await). Errors: throw `HttpError`; 5xx text is hidden unless `expose` is true; use `dbFailed()` for database errors. Server handler is `server/app.ts` (tests in `server/app.test.ts`).

**Next, in this order:**

1. **T8 (timebox 25 min), `api/verify.ts`.** Validate the body (fact `type` in the six allowed values, `value` a short string, `remove` ids are UUIDs) and check every Supabase `error`; return a generic 500 through `dbFailed()` instead of reporting success. Full atomicity (all facts plus the visit in one transaction) needs a Postgres function: **schema change, ask first**. Without it, write the facts, then the visit, and report which step failed.
2. **T9 (timebox 15 min), `src/components/hospital/EndVisit.tsx`.** Show the save error and a Retry button instead of staying on "Saving". Depends on T8 returning real errors.
3. **T6: blocked on D3.** Doctors can read any patient's facts with a valid session and a patient id. Needs a team decision on how the patient authorises (confirm on their own phone, or a code from their card). Do not start without it.

Then T11 (timeouts on Brevo and YarnGPT) → T22 + T25 + T26 → T16 if time remains. After each: verify, commit, push, update `.agent/`.
