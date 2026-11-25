# Requirements status

Compares the original requirements ([voxcare_build_prompt.md](../voxcare_build_prompt.md), "the spec") with the code on `dev` as of 2026-11-25, after merging the collaborator's `main` (one- and two-device visits). Task IDs (T…), decisions (D…) and issues (S…, W…) are in [.agent/](../.agent/).

**Legend.** **Done**: built, and checked by tests or by reading the code. **Partial**: part of it is built; the gap is stated. **Deviation**: built differently on purpose (approved in [.agent/decisions.md](../.agent/decisions.md)). **Outstanding**: not built, or not yet verified where the spec requires a real-device check.

"Verified" in this file means tests, type check, lint, build, reading the code, or a **headless browser run** (Microsoft Edge on a local mock API, see [.agent/progress.md](../.agent/progress.md) "Browser verification"). Nothing has been tested on a real phone or tablet. See "Needs a real device" at the end.

**Scope for submission:** the original working solution. Architecture improvements are documented as outstanding, not built (atomic visit save, doctor sign-in redesign, patient authorisation codes, card deletion and revocation, SMS).

## Approved deviations

| Spec | Built | Why / status |
|---|---|---|
| §9 Family alert by **Termii SMS**, banner "Family has been told." | **Brevo email** to a help person who joined through a link. The banner reads "Family has been emailed." | Kept as built (decision 2026-11-25). Switching to SMS needs a Termii key and sender ID: D4 / T14 |
| §7.2 step 4 **Check**: WhatsApp test message, then tick "It's them" / cross "Dial again" | The WhatsApp message carries a **join link**. The help person opens it and enters an email, and the patient's screen shows when they have joined. The link expires after 72 h and works once (T2) | Kept as built. Needed so the help person gives an email address for alerts |
| §3 React 18 | React 19 | Kept as built |
| §3 Serverless functions on Vercel | Handlers in `api/` served by a Node server on **Render**; Vercel hosts only the frontend | Architecture choice by the team |
| §5 `doctors.pin` hashed | Unsalted SHA-256 of a 4-digit PIN, with rate limits (T1) | Partial mitigation approved; full fix deferred: D1 |
| §5 Seed doctor PIN `1234` | `1234` works only outside production; production needs a private PIN (W1) | Security fix (T1) |

## Done

| Spec | Notes |
|---|---|
| §3 Stack: Vite, TypeScript strict, Tailwind v4 tokens, motion, lucide (staff UI), fonts, zustand persist, Supabase, qrcode.react, @zxing/browser, vite-plugin-pwa, ESLint | `package.json`, `src/index.css` |
| §3 Lazy-loaded routes | 11 `lazy()` routes in `src/App.tsx` |
| §5 Tables, buckets, RLS, seed data | `supabase/schema.sql` (RLS on, no policies; all access through the API with the service role) |
| §5 Emergency endpoint returns only the briefing subset, never transcripts | `api/emergency.ts`; offline copy stores only this subset (T16 test) |
| §5 Device keeps patient id and secret token | `src/store/device.ts` |
| §6 Typed asset catalogue | `src/data/assets.ts` |
| §7.1 Landing page, 5 sections | `src/pages/Landing.tsx`. Uses project assets; no Unsplash photos (optional in the spec) |
| §7.2 Consent, Me (camera / gallery / skip), Help (dial pad, contact picker where supported), Card (QR, Web NFC write or copy-link fallback) | `src/pages/setup/`, `src/pages/Card.tsx` |
| §7.3 Home with "Add more about me" (self-reported facts) | `src/pages/Home.tsx` |
| §7.4 Hospital mode: PIN login, scan or walk-in, Allow / No, teach clip and practice tap, 2×2 grid, body map with pins, regions and `?debug=regions`, pain kind / level / duration, sentence builder, doctor panel, picture questions and instructions, gestures, free text, End visit with fact verification | `src/pages/Hospital.tsx`, `src/components/`. Split view 3fr / 2fr on large screens |
| §7.4 Hospital flow in a browser | Headless run: PIN, demo patient, Allow, teach clip, practice tap, body map pin "Right knee", sharp, very bad, 3 days, giving "I have a sharp pain in my right knee. It is very bad. It started 3 days ago." End visit save failure shows the error and Try again; the retry saves |
| §7.4 Visit on one or two devices (from `main`) | One device verified in the browser. Two devices (Supabase Realtime, 6-digit code) not tested here |
| §7.4 Sentence builder unit tests, 15+ combinations | 31 tests in `src/lib/sentence.test.ts` |
| §7.5 Emergency page: alert on load with GPS (5 s timeout), photo, name, red pill, Play briefing in 4 languages with chips, verified / not-confirmed facts, Ask the patient, Call and WhatsApp location | `src/pages/Emergency.tsx` (alert channel: see deviations) |
| §8 YarnGPT briefings: 4 languages, cache key, reuse, storage upload, background regeneration after setup and verify, English speech fallback | `api/_lib/briefing.ts` (tests in `api/briefingRuns.test.ts`); timeouts added (T11) |
| §9 Rate limit: one alert per patient per 10 min | `api/alert.ts` (T3, T12) |
| §10 `prefers-reduced-motion` respected | `MotionConfig reducedMotion="user"` (T25) |
| §10 README with setup, env vars, schema and seed data, deploy steps | `README.md` |
| §10 Initial JS under 200 KB gzipped | Measured on the local build: entry chunk about 70 KB + preloaded chunk about 18 KB gzipped. The route chunk for each page loads after that |

## Partial

| Spec | What is missing |
|---|---|
| §3, §8, §10 **Offline** (browser-checked on a mock API: own phone shows the saved card with "Saved on this phone on <date>" and plays the saved audio; a phone without a copy says "No connection"; a responder phone stores nothing) ("caches the app, assets and briefing audio"; "works offline after the first load") | The app shell is precached. T16 now keeps the patient's **own** emergency card, its 4 MP3s and photo on their phone for 7 days, refreshed on Home and on the emergency page while online, and cleared on reset. Not covered: a **responder's** phone has no offline copy of someone else's card (by design: it is private data), and the first open needs a connection. Not yet checked in a real browser (Supabase storage must allow CORS downloads) |
| §5 "keep it simple but sensible" security | Open: doctor access is not authorised by the patient (S4, T6, D3), the emergency link cannot be revoked (S5, T7, D2), sessions are signed with the service role key (S8, T5) |
| §7.4 End visit saves verified facts | Validated and safe to retry (T8, T9), but **not atomic**: a failure part-way leaves some facts saved until the doctor retries (P1, needs a migration) |
| §7.1 Trust "you can delete anytime" | Shown on the landing and consent screens, but there is no delete function yet (T7, D2) |
| §10 Accessibility: alt text, visible focus, ARIA labels on icon buttons | Checked by reading the code and by tests on shared components (T26, `src/components/ui.test.tsx`, `test/a11y.test.ts`). Colour contrast, screen reader and axe checks not run (T27) |

## Outstanding

| Spec | Status |
|---|---|
| §9 Termii SMS | Deferred after submission; email is used (T14) |
| §10 Lighthouse Performance 90+ and Accessibility 95+ on mobile | Local run (no compression, mock API): accessibility 96 on landing and emergency; performance emergency 91, **landing 49–79** (hero image LCP about 5.5 s on throttled mobile). Re-measure on the deployed site |
| §10 Every screen looks intentional at 375, 820, 1180 and 1440 px | No horizontal overflow on 7 main routes at all 4 widths (headless). Visual quality not judged by a person |
| §10 Good colour contrast | axe flags palette colours: ember text on ivory, white on alert red, muted on sand. Not changed (palette fixed by the spec); needs a design decision |
| §10 Functional checks "on a real phone and tablet over HTTPS" | None done in this work. See below |
| Delete card / revoke emergency link | T7, deferred after submission |
| Patient authorisation of doctors | T6, deferred after submission |
| Atomic visit save (P1), doctor sign-in redesign (D1) | Deferred after submission; partial mitigations in place (T8, T1) |

## Needs a real device or browser

1. Setup end to end, including skipping the photo and the WhatsApp join link.
2. QR scan, and NFC write and read on Android Chrome.
3. Hospital flow: body map regions on both sides, spoken sentence, picture question answered and spoken.
4. End visit: save, error and retry (stop the API to force an error), briefing regenerates once.
5. Emergency page from another phone: email alert, banner, 4-language playback.
6. **Offline (T16):** on the patient's phone, open Home online, switch to airplane mode, open the card's emergency link: the facts, photo and all 4 audio files must work. On a second phone that scanned the card, nothing may be stored (DevTools, Application, Cache Storage: no `vc-offline-card-v1`).
7. Reduce-motion setting; Lighthouse and axe at the four widths (T27).
