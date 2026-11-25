# Handoff (start here)

Last updated: 2026-11-25 13:45 WAT, session 4 (after T16, T20, T15, T17, T27 static checks).

## Read first

[AGENTS.md](../AGENTS.md) (rules), then this file, then [roadmap.md](roadmap.md) and [blockers.md](blockers.md). Requirements: [voxcare_build_prompt.md](../voxcare_build_prompt.md). Setup, deploy and tests: [README.md](../README.md).

## Where things stand

- **Purpose:** help Deaf and speech-impaired Nigerians communicate with doctors and responders through pictures, a body map, spoken sentences, an emergency page that alerts family, and voice briefings in four languages.
- **Architecture:** React PWA (`src/`, Vercel) → Node API (`server/index.ts` serving `api/*.ts`, Render) → Supabase, YarnGPT, Brevo. Patient device keeps a secret token; doctors get a 12 h HMAC session token.
- **Branch:** `dev`. Session 4 commits not yet pushed (network). PR target `main` (untouched).
- **Done:** T0 `fa32bbc`; T1 `76f367a` (**partial**, S1 not fully fixed); docs `47a09ec`, `8b70c7d`; T2 `dd9e5ac` (S2 fixed); T4 `41b3d5d` (S7, S9, S10 fixed; T18 done); T3 `4ebae50` (S3 mitigated); T8 `76359ed` (**partial**); T9 `d057bf2`; T12 `392a21d`; T22 `8f95a80` + `edf2808`; T11 `e3b8303`; T10 `2c98454`; T13 `52fc8a6`; T25 + T26 `a0465d3`.
- **Session 4:** T16 `e8e6b95`, T20 `5c72183`, T17 `b0d334d`, T27 static checks `1f0201d`, docs (this commit). Requirements comparison: [docs/requirements-status.md](../docs/requirements-status.md).
- **Push blocked again:** github.com resets the connection (fetch and push). Session 4 commits are local. First action: `git push origin dev` (never force).
- **No AI attribution** in commits or PRs (AGENTS.md).
- **Verification:** 274/274 tests, lint 0, `tsc -b` and `tsc -p api/tsconfig.json` 0 errors, build ok, no keys in the build.
- **Time:** budget ends **15:40 WAT** on 2026-11-25; final checks and PR prep from 15:10.

## Must know before deploying

Set a private doctor PIN (W1), keep `NODE_ENV=production` (W2), single Render instance (W3), check `source: 'forwarded'` in logs (W4), list every frontend origin in `FRONTEND_URL` (W6), Vercel installs devDependencies (W8). Details in [blockers.md](blockers.md).

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
8. **Offline emergency page (T16):** on the patient's own phone without signal, the emergency page shows the saved card and plays the saved audio, where it used to show "This card was not found". The layout is unchanged and there is no "saved copy" label.

## Exact next action

0. **B1 first:** `main` moved (`b93a477`); `dev` conflicts in 7 files. See [blockers.md](blockers.md). Merge `origin/main` into `dev` with approval before preparing the PR.

1. `git push origin dev` (session 4 commits). Never force. Then confirm the PR's "Checks" workflow runs green on GitHub.
2. **Team decisions:** P1 ([proposals/P1-atomic-visit-save.md](proposals/P1-atomic-visit-save.md)), P2/D3 (T6, below), D2 (T7), D4 (T14).

### Next session

**Pending collaborator approval (do not implement yet):** atomic medical record transactions (P1), doctor authentication redesign (D1), patient authorisation codes (P2/D3), card deletion and revocation (D2/T7). Also open: SMS vs email (D4/T14).

**T16 offline is done in code; verify in a browser.** `npm run build && npx vite preview` with a **non-production** API (W10), or on the Vercel preview once W9 is checked. On the patient's phone: open Home online, then airplane mode, then open the card link: facts, photo and the 4 audio files must work. DevTools, Application, Cache Storage: only `vc-offline-card-v1` with one card JSON plus its MP3s and photo. On another phone that scans the card: no such cache. If audio fails, check Supabase storage CORS. Design note: offline shows no "saved copy" label (would be a UI change; ask first).

**T27:** Lighthouse (mobile) and axe at 375 / 820 / 1180 / 1440 px on a preview build. Static checks and bundle size are done (`test/a11y.test.ts`; about 88 KB gzipped initial JS).

**Optional (need approval for new dependencies):** T19 Playwright, T21 coverage, T23 remove `@vercel/node`. T5 needs a new env var.

**Final verification before the PR:** `npx vitest run`, `npx eslint .`, `npm run typecheck`, `npm run build`; scan `dist` and the full diff for `.env` values; on a phone check the setup flow, join link, emergency page + alert, EndVisit error and retry (stop the API to force one), and reduce motion; walk W1–W8 in [blockers.md](blockers.md); write the PR description into `main` (do not merge).

### Reference

**T8 state:** validated, every DB error reported, retry-safe, not atomic (P1).

**T6 recommendation (P2, not started, blocked on D3):** today the doctor's own phone taps "Allow", and any signed-in doctor with a patient id (it is in the public card QR) can read and change facts. Smallest real patient authorisation, no schema change:
- On the patient's phone (it holds the device token), a "Show to doctor" button calls `POST /api/visit-grant {patientId, token}` and shows a 6-digit code valid 10 min.
- The doctor enters the code; the server checks it (single use, in memory like the limits, 5 tries) and returns a signed grant `doctorId.patientId.exp` (HMAC, 2 h).
- `GET /api/facts` and `POST /api/verify` require that grant for that patient. The emergency page stays open (it is for responders).
- Not acceptable: a consent record the doctor creates, or treating the card QR as consent.
