# Handoff (start here)

Last updated: 2026-11-25 12:45 WAT, session 3 (after T8, T9, T12, T22).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`, in sync with `origin/dev`. PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); docs `47a09ec`, `8b70c7d`; T2 `dd9e5ac` (S2 fixed); T4 `41b3d5d` (S7, S9, S10 fixed; T18 done); T3 `4ebae50` (S3 mitigated); T8 `76359ed` (**partial**); T9 `d057bf2`; T12 `392a21d`; T22 `8f95a80`.
- **Push blocked:** GitHub unreachable from this machine; `dev` is 7 commits ahead of `origin/dev`. First action: `git push origin dev`.
- **Verification:** 230/230 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4), list every frontend origin in `FRONTEND_URL` (W6), Vercel installs devDependencies (W8). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## Exact next action

1. `git push origin dev` (7 local commits).
2. **Team decisions:** P1 (T8 atomic save, migration) and P2/D3 (T6), both in [decisions.md](decisions.md).
3. **T11 (timebox 20 min):** timeouts on Brevo and YarnGPT `fetch` calls (`AbortSignal.timeout`), so an alert cannot hang. Then T25 + T26, T16 if time remains.

**T8 state:** `api/verify.ts` validates first, reports every DB error, and is retry-safe (facts matched by id or type+value, client `visitId`, per-patient queue). Not atomic: a failure part-way leaves earlier writes until the doctor retries (EndVisit shows Try again). P1 makes it one transaction.

**T6 recommendation (P2, not started, blocked on D3):** today the doctor's own phone taps "Allow", and any signed-in doctor with a patient id (it is in the public card QR) can read and change facts. Smallest real patient authorisation, no schema change:
- On the patient's phone (it holds the device token), a "Show to doctor" button calls `POST /api/visit-grant {patientId, token}` and shows a 6-digit code valid 10 min.
- The doctor enters the code; the server checks it (single use, in memory like the limits, 5 tries) and returns a signed grant `doctorId.patientId.exp` (HMAC, 2 h).
- `GET /api/facts` and `POST /api/verify` require that grant for that patient. The emergency page stays open (it is for responders).
- Not acceptable: a consent record the doctor creates, or treating the card QR as consent (anyone who sees the card can scan it).
