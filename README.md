# VoxCare

Helps Deaf and speech-impaired people in Nigeria communicate with doctors and first responders using pictures.
Vite + React + TypeScript, Tailwind v4, Vercel functions (`/api`), Supabase, YarnGPT, Brevo (email).

## Run locally

```bash
npm install
cp .env.example .env      # fill in the values (see below)
npm run dev               # front end only; /api falls back to seeded mock data
npx vercel dev            # front end + /api functions with your real keys
npm test                  # all tests (see "Tests" below)
```

Without a backend the app runs on a seeded mock (demo patient, doctor PIN 1234) stored in localStorage.

For phone testing over HTTPS (camera, location, NFC need it) use `ngrok http 3000` or a Cloudflare Tunnel.

## Environment variables

| Variable | Used for |
| --- | --- |
| `YARNGPT_API_KEY` | Text-to-speech briefings (server only) |
| `BREVO_API_KEY` | Sends the emergency alert and welcome emails (server only) |
| `BREVO_SENDER_EMAIL` | The "from" address. Must be a sender verified in Brevo |
| `BREVO_SENDER_NAME` | The "from" name. Defaults to `VoxCare` |
| `DEMO_HELP_EMAIL` | Receives the alert for the seeded demo patient, and the `/dev/test-email` test |
| `DEMO_HELP_PHONE` | Phone behind the Call button for the seeded demo patient |
| `DEMO_MODE` | `true` or `false` (default `false`). When `true`, every WhatsApp link opens `DEMO_WHATSAPP_NUMBER` and a small "Demo mode" pill shows |
| `DEMO_WHATSAPP_NUMBER` | Digits only with country code, e.g. `2348012345678` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Also signs doctor session tokens |

Brevo is only ever called from the server, in `sendAlertEmail` and `sendWelcomeEmail` in `api/_lib/email.ts`.
`DEMO_MODE` and `DEMO_WHATSAPP_NUMBER` are readable by the browser (they only decide where a WhatsApp link points). All other keys stay on the server.
Every WhatsApp link is built by `whatsappLink()` in `src/lib/whatsapp.ts`. The dialled number is still saved and used for the Call button.

## How the help person joins

The patient never types an email. At setup the patient sends a WhatsApp message with a link, `/join/<token>`. The help person opens it, enters their own email and taps Join. We save the email, send a welcome email, and the patient's screen (which checks every 3 seconds) shows "They joined". When an emergency page opens, `/api/alert` emails that address (at most one alert per patient every 10 minutes).

The join link works once and expires after 72 hours (`api/_lib/invite.ts`). After a help person has joined, the link cannot replace them. If the link expires before anyone joins, the patient's Check screen quietly gets a new one (`POST /api/join` with `action: "reinvite"` and the device token), and the old link stops working.

To test the email without a real emergency, run `npx vercel dev`, open `/dev/test-email` and press the button. It sends a sample alert to `DEMO_HELP_EMAIL`. The route exists in development only.

## Database

1. Create a Supabase project.
2. Open the SQL editor, paste [supabase/schema.sql](supabase/schema.sql) and run it. It creates the tables, row-level security, the `briefings` and `photos` buckets, and the seed data (Dr. Ngozi Okafor with PIN 1234, and the demo patient).

RLS is on with no policies, so the anon key can read and write nothing. Every read and write goes through `/api` using the service role key. The emergency endpoint returns only the briefing subset, never visit transcripts.

## Deploy: backend on Render, frontend on Vercel

The frontend (Vercel) and the backend (Render) are separate. The backend is `server/index.ts`, which serves the handlers in `api/`.

### 1. Backend on Render (do this first)

Create a **Web Service** from the repo.

| Setting | Value |
| --- | --- |
| Language | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Instance type | Paid, always-on (a free instance sleeps and the first request takes 30 to 60 seconds) |

Environment variables (Render, Environment tab):

`NODE_VERSION=22`, `NODE_ENV=production`, `YARNGPT_API_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `DEMO_HELP_EMAIL`, `DEMO_HELP_PHONE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and:

- `FRONTEND_URL`: your Vercel address, e.g. `https://voxcare.vercel.app`. It is the only origin allowed to call the API (CORS) and it is the base of the links inside emails. Use a comma to allow more than one (for example a custom domain). No trailing slash. In production only these origins are allowed; `http://localhost` and `127.0.0.1` are allowed only when `NODE_ENV` is not `production`. Vercel preview URLs are refused unless you list them.

Check it: `https://<your-service>.onrender.com/health` should return `{"ok":true,"service":"voxcare-api"}`.

### 2. Frontend on Vercel

Import the repo. The framework preset is Vite. Build command `npm run build`, output `dist`. Vercel ignores `api/` and `server/` (see `.vercelignore`).

Environment variables (Vercel, Settings, Environment Variables). These are read at build time, so redeploy after changing them:

- `VITE_API_URL`: the Render address, e.g. `https://voxcare-api.onrender.com`. No trailing slash.
- `DEMO_MODE` and `DEMO_WHATSAPP_NUMBER`.

Then put the final Vercel address back into Render as `FRONTEND_URL` if it changed.

### 3. Check it

Open `https://<your-vercel-address>/e/demo`. It should load the demo patient. Then run a hospital visit and sign in with the doctor PIN you set for production (see "Doctor sign-in": the public PIN 1234 is refused in production).

In a deployed build the app never falls back to mock data. If the API address is wrong or the server is down, requests fail visibly instead of faking a patient.

## Doctor sign-in

Doctors sign in with a 4-digit PIN (`/api/doctor-login`). The PIN is stored as `sha256('voxcare:' || pin)`.

**Production refuses the public demo PIN `1234`** (when `NODE_ENV` or `VERCEL_ENV` is `production`). Locally it still works. To demo on the live site, give the seeded doctor a private PIN in the Supabase SQL editor (never commit it):

```sql
update public.doctors
set pin = encode(extensions.digest('voxcare:' || '<new 4-digit PIN>', 'sha256'), 'hex')
where id = 'd0c70000-0000-4000-8000-000000000001';
```

**Brute-force protection** (in [api/doctor-login.ts](api/doctor-login.ts)):

- 5 attempts per client per 15 minutes, then `429` with `Retry-After`. A successful sign-in clears that client's count.
- 50 unsuccessful attempts from all clients together per 15 minutes, then everyone gets `429` until the window passes. This slows guessing spread over many addresses, but someone with many addresses can use it to block sign-in for every doctor for up to 15 minutes.
- The client is identified by the TCP peer address. `X-Forwarded-For` is only read when the peer is a private address (Render's proxy), and only its last entry, which the proxy appended. IPv6 clients are grouped by /64.
- Database errors return `503` and do not count as attempts. Logs never contain PINs, hashes, tokens or client addresses.

**Limitations.** The counts are kept in memory: a restart or redeploy clears them, and each server instance counts separately, so **run a single Render instance**. If a CDN or second proxy is put in front of Render, every user arrives from that proxy's address and shares one limit. A 4-digit PIN has only 10,000 possibilities, and the unsalted hash can be reversed instantly by anyone who can read the `doctors` table. Per-doctor lockout, longer PINs and a slow salted hash need a doctor identifier at sign-in; that change is proposed, not yet made.

## API abuse limits and errors

Limits per client address ([api/_lib/limits.ts](api/_lib/limits.ts)), answered with `429` and `Retry-After`:

| Endpoint | Limit | Why |
|---|---|---|
| `POST /api/patient` | 5 per hour per client, 100 per hour in total | Each new patient starts 4 paid YarnGPT jobs |
| `POST /api/briefing` | 10 per 10 min | Paid when the facts changed |
| `POST /api/join` (join and new link) | 10 per 15 min | Stops link guessing and spam |
| `POST /api/alert` | 10 per 10 min per client; 1 email per patient per 10 min | Notifies a person. A repeat within 10 min returns `{ sent: true, reason: "rate_limited" }`, not an error |
| `GET /api/emergency` | none | Reading emergency information is never limited |

Counts are taken before any database or network call, so parallel requests cannot get past them. They use the same client identification and have the same limits as doctor sign-in below (in memory, single Render instance).

Server errors return a generic message (`Something went wrong. Please try again.`); `4xx` messages are unchanged. Logs record the path without the query string, database error codes (not messages) and provider status codes (not response bodies). Patient ids, tokens and emails are not logged.

## Tests

`npm test` runs Vitest over `src/`, `api/`, `server/` and `test/`. [test/setup.ts](test/setup.ts) runs first in every test file:

- Every key is replaced by a dummy from [test/env.ts](test/env.ts), and the run stops if a real one is found. Your `.env` is never used by tests.
- Network access is blocked ([test/networkGuard.ts](test/networkGuard.ts)): `fetch` and any TCP or TLS connection to a non-local host fail with `ERR_TEST_NETWORK_BLOCKED`. Localhost stays allowed.
- `createClient` from `@supabase/supabase-js` returns an in-memory fake ([test/mocks/supabase.ts](test/mocks/supabase.ts)), so tests cannot touch a real Supabase project.
- After each test: fake database emptied, rate limits cleared, timers, mocks, stubbed globals and environment restored.

Helpers: `invoke()` in [test/http.ts](test/http.ts) calls an `/api` handler directly; `mockFetch()` in [test/mocks/fetch.ts](test/mocks/fetch.ts) fakes Brevo, YarnGPT or the API by URL.

**Pull request checks:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, both type checks, the tests and the build on every pull request into `main`. It uses dummy values only, needs no repository secrets and deploys nothing.

## Notes

- `?debug=regions` on any body map draws the calibrated body-region polygons.
- Briefings are cached by `sha256(text + language + voice)`. YarnGPT is only called when the text changes, and each real call is logged.
- Emergency audio is returned only if it matches the current verified facts. Otherwise the phone speaks the current English text.
- **Offline emergency card:** the patient's own phone keeps a copy of its emergency card (the same data the QR code shows), the four briefing MP3s and the photo in the `vc-offline-card-v1` cache ([src/lib/offline.ts](src/lib/offline.ts)). It is refreshed on Home and on the emergency page while online, expires after 7 days, and is deleted when the device is reset, a new card is set up, or the server says the card no longer exists. A responder's phone that scans someone else's card stores nothing. Anyone holding the unlocked phone can read the copy. Supabase storage must allow CORS downloads (it does for public buckets by default).
- Landing photos use the VoxCare asset pack only. No third-party photos, so there are no credits to add.
