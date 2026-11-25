# Handoff (start here)

Last updated: 2026-11-25, session 5 (main merged into dev, browser verification, final handoff).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` → `server/app.ts` → `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Visits (from `main`) are created on the server with a 6-digit code; two-device visits use Supabase Realtime in the browser.
- **Branch:** `dev` includes `origin/main` (`b93a477`) since merge `d32f172`. Backup of pre-merge `dev`: local branch `backup/dev-before-main-merge`. `main` untouched. PR `dev` → `main` is for the collaborator to review and merge.
- **Scope:** original working solution. Deferred and documented: P1 atomic visit save, D1 doctor sign-in redesign, P2/D3 patient authorisation codes, D2 card deletion and revocation, D4 SMS.
- **Verification:** 300/300 tests, lint 0, both type checks, build ok. Headless Edge run on a mock API: see [progress.md](progress.md) "Browser verification". Requirements: [docs/requirements-status.md](../docs/requirements-status.md).
- **Push:** GitHub connections are intermittent here. If `git status` shows `dev` ahead, `git push origin dev` (never force).

## Must know before deploying

**Apply the visit schema from `supabase/schema.sql` to the target database first (W11)**, set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4), list every frontend origin in `FRONTEND_URL` (W6), Vercel installs devDependencies (W8). Details in [blockers.md](blockers.md).

## Decisions

Approved and deferred items are in [decisions.md](decisions.md). Waiting on the team: D1 (S1 full fix), D2 (delete card), D3 (patient authorisation), D4 (SMS vs email).

## User-visible changes for the collaborator to approve

All small and kept to the existing design; listed so the PR review can accept or reject each:

1. **EndVisit (T9):** on a failed save a red "Not saved. <reason>" box appears and the button reads "Try again". Before, the screen stayed on "Saving" forever.
2. **Server error text (T4):** unexpected errors show "Something went wrong. Please try again." instead of internal messages.
3. **Rate limits (T3):** heavy use gets "Too many requests. Wait a few minutes and try again."
4. **Join link (T2):** an expired link shows the existing "This link is not valid / Ask your friend to send it again" screen; joining twice says "Someone has already joined with this link".
5. **Consent pictures (T26):** look the same but are no longer tappable or focusable (they did nothing).
6. **Reduced motion (T25):** with the phone's reduce-motion setting on, motion animations are minimised.
7. **Check screen (T2):** an expired link is replaced in the background; nothing visible changes.
8. **Offline emergency page (T16):** on the patient's own phone without signal, the emergency page shows the saved card and plays the saved audio, with one muted line: "Saved on this phone on <date>. No connection, so this may not be up to date." Without a saved copy it says "No connection" instead of "This card was not found".
9. **Join page (merge):** after joining, the page says whether the welcome email was sent (from `main`).

## Exact next action

1. `git push origin dev` if anything is unpushed. Confirm the "Checks" workflow is green on the PR.
2. Owner (yusufwahab): check W9 (what a `dev` push deploys), W11 (visit schema in the database), W1 (private PIN), then review and merge the PR.
3. On real phones (cannot be done here): NFC write/read, camera QR scan, real welcome and alert emails, real YarnGPT audio, two-device visit over Realtime, iOS Safari, offline on a phone in airplane mode.

### Outstanding to explain in the presentation

- Family alerts are **email** (Brevo), not SMS; Termii is planned (D4).
- Saving a visit is retry-safe but **not one database transaction** (P1, needs a migration).
- Doctor sign-in is a 4-digit PIN with rate limits; MDCN + stronger PIN hashing is planned (D1).
- Any signed-in doctor with a card id can read and update its facts; patient approval codes are planned (P2/D3).
- "Delete anytime" is promised but not built; the emergency link cannot be revoked yet (D2).
- Rate limits are in memory: run one Render instance (W3).
- Landing page performance under throttled mobile is below 90 locally; palette contrast flagged by axe.

### Reference

**T8 state:** validated, every DB error reported, retry-safe, not atomic (P1).

**Final verification before the PR:** `npx vitest run`, `npx eslint .`, `npm run typecheck`, `npm run build`; scan `dist` and the full diff for `.env` values; on a phone check the setup flow, join link, emergency page + alert, EndVisit error and retry (stop the API to force one), and reduce motion; walk W1–W8 in [blockers.md](blockers.md); write the PR description into `main` (do not merge).

### Reference

**T8 state:** validated, every DB error reported, retry-safe, not atomic (P1).

**T6 recommendation (P2, not started, deferred after submission):** today the doctor's own phone taps "Allow", and any signed-in doctor with a patient id (it is in the public card QR) can read and change facts. Smallest real patient authorisation, no schema change:
- On the patient's phone (it holds the device token), a "Show to doctor" button calls `POST /api/visit-grant {patientId, token}` and shows a 6-digit code valid 10 min.
- The doctor enters the code; the server checks it (single use, in memory like the limits, 5 tries) and returns a signed grant `doctorId.patientId.exp` (HMAC, 2 h).
- `GET /api/facts` and `POST /api/verify` require that grant for that patient. The emergency page stays open (it is for responders).
- Not acceptable: a consent record the doctor creates, or treating the card QR as consent.
