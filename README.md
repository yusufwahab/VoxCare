# VoxCare

Helps Deaf and speech-impaired people in Nigeria communicate with doctors and first responders using pictures.
Vite + React + TypeScript, Tailwind v4, Vercel functions (`/api`), Supabase, YarnGPT, Brevo (email).

## Run locally

```bash
npm install
cp .env.example .env      # fill in the values (see below)
npm run dev               # front end only; /api falls back to seeded mock data
npx vercel dev            # front end + /api functions with your real keys
npm test                  # sentence builder + body region tests
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
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and anon key. The anon key is public by design; the frontend uses it only for Realtime in two-device visits |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Also signs doctor session tokens |

Brevo is only ever called from the server, in `sendAlertEmail` and `sendWelcomeEmail` in `api/_lib/email.ts`.
`DEMO_MODE`, `DEMO_WHATSAPP_NUMBER`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are readable by the browser. All other keys stay on the server.
Every WhatsApp link is built by `whatsappLink()` in `src/lib/whatsapp.ts`. The dialled number is still saved and used for the Call button.

## How the help person joins

The patient never types an email. At setup the patient sends a WhatsApp message with a link, `/join/<token>`. The help person opens it, enters their own email and taps Join. We save the email, send a welcome email, and the patient's screen (which checks every 3 seconds) shows "They joined". When an emergency page opens, `/api/alert` emails that address (at most one alert per patient every 10 minutes).

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

- `FRONTEND_URL`: your Vercel address, e.g. `https://voxcare.vercel.app`. It is the only origin allowed to call the API (CORS) and it is the base of the links inside emails. Use a comma to allow more than one (for example a custom domain). No trailing slash.

Check it: `https://<your-service>.onrender.com/health` should return `{"ok":true,"service":"voxcare-api"}`.

### 2. Frontend on Vercel

Import the repo. The framework preset is Vite. Build command `npm run build`, output `dist`. Vercel ignores `api/` and `server/` (see `.vercelignore`).

Environment variables (Vercel, Settings, Environment Variables). These are read at build time, so redeploy after changing them:

- `VITE_API_URL`: the Render address, e.g. `https://voxcare-api.onrender.com`. No trailing slash.
- `DEMO_MODE` and `DEMO_WHATSAPP_NUMBER`.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: needed for two-device visits (Supabase Realtime runs in the browser). Without them, "Two devices" is disabled.

Then put the final Vercel address back into Render as `FRONTEND_URL` if it changed.

### 3. Check it

Open `https://<your-vercel-address>/e/demo`. It should load the demo patient. Then run a hospital visit, sign in with PIN 1234.

In a deployed build the app never falls back to mock data. If the API address is wrong or the server is down, requests fail visibly instead of faking a patient.

## Visit modes

Every visit is created on the server when the doctor starts it, and gets a 6-digit code.

- **One device:** doctor and patient share a tablet or phone. A wide landscape tablet shows the split view. A phone or a portrait tablet shows one person at a time, with a "Hand to patient" button.
- **Two devices:** the patient uses their own phone, nearby or remote. They join by scanning the QR code, typing the code at `/v`, or opening the link (`/v/<visitId>?role=patient&code=<code>`, sent over WhatsApp or copied). If the doctor scanned the patient's card and VoxCare is open on the patient's phone, it asks Allow or No.
- **Switch anytime:** "Use two devices" and "Use one device" move the same visit across without losing anything.

How it works: everything that happens is a typed event (`src/visit/events.ts`) handled by one reducer (`src/visit/reducer.ts`). One device applies events directly. Two devices also send them over Supabase Realtime Broadcast on the channel `visit:<visitId>`, and every event is appended to `visits.transcript`. A device that joins or reconnects replays the transcript to catch up.

Realtime needs "Allow public access" left on in Supabase, Project Settings, Realtime (the default). The channel name is a random id and the API checks the code, but anyone who knows the visit id can listen on the channel, so treat visit links like private links.

## Notes

- `?debug=regions` on any body map draws the calibrated body-region polygons.
- Briefings are cached by `sha256(text + language + voice)`. YarnGPT is only called when the text changes, and each real call is logged.
- Emergency audio is returned only if it matches the current verified facts. Otherwise the phone speaks the current English text.
- Landing photos use the VoxCare asset pack only. No third-party photos, so there are no credits to add.
