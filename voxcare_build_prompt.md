# VoxCare: full build prompt (fresh React implementation)

You are building **VoxCare** from scratch. VoxCare helps Deaf and speech-impaired people in Nigeria communicate with doctors and first responders **without speaking, hearing, reading or writing**. It's being demoed live to hackathon judges, so it must **actually work** and look **world-class**.

This is a fresh implementation. Do not reuse any previous VoxCare design, colours or screens. Read this whole document, the design reference image and the asset pack before writing code. If anything is missing, ask me exactly what you need and why. Otherwise, build without interruptions.

---

## 1. What you're given

1. **`VoxCare_assets_webp.zip`**: every image and clip. Unzip into `public/assets/voxcare/`. Section 6 says what each one is for.
2. **`design-reference.jpg`**: a landing page I like. It's **inspiration for quality and feel only**: warm, photographic, generous spacing, pill buttons, monospace eyebrow labels, glassy cards on photos, confident typography. Don't copy its layout or content.
3. **Environment variables** (I'll paste the values into `.env` and Vercel):
   - `YARNGPT_API_KEY`: Nigerian-language text-to-speech
   - `TERMII_API_KEY` and `TERMII_SENDER_ID`: SMS alerts to family
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: database and file storage
   - `DEMO_HELP_PHONE`: a teammate's number used by the seeded demo patient

---

## 2. Product in one paragraph

A patient sets up a **VoxCare card** alone in about 20 seconds (consent, optional photo, one help person's number). At a hospital, the patient **taps where it hurts on a realistic mannequin** and picks real-life pictures. VoxCare turns that into a **spoken sentence** for the doctor. The doctor **asks questions back with pictures**, and the patient answers with a tick or a cross. At the end, the doctor **verifies medical facts**, which are saved to the card. In an emergency, a responder **taps the NFC sticker or scans the QR code**. The family is **alerted automatically by SMS** with a location, and a **voice briefing** plays in **English, Yoruba, Igbo and Hausa**, reading the doctor-verified facts.

**Golden rule:** the patient never _has_ to read, write, speak or hear. Every choice is a **real photo or clip with a short label underneath**. Typing is always optional. No emoji anywhere.

---

## 3. Tech stack (install these)

- **Vite + React 18 + TypeScript**: `npm create vite@latest voxcare -- --template react-ts`
- **Routing:** `react-router-dom` with lazy-loaded routes (`React.lazy` + `Suspense`)
- **Styling:** **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/vite`), with design tokens defined as CSS variables in `@theme`
- **Motion:** `motion` (Framer Motion) for page transitions, card presses and the pin drop. Subtle, fast and purposeful. Respect `prefers-reduced-motion`.
- **UI icons (navigation and staff UI only, never as patient content):** `lucide-react`
- **Fonts:** `@fontsource-variable/plus-jakarta-sans` (UI and headings), `@fontsource/jetbrains-mono` (small uppercase eyebrow labels and badges)
- **State:** `zustand` (with `persist` for the device's own data)
- **Database and storage:** `@supabase/supabase-js`
- **QR codes:** `qrcode.react`; **QR scanning:** `@zxing/browser`
- **PWA and offline:** `vite-plugin-pwa` (installable on a tablet; caches the app, assets and briefing audio)
- **Serverless functions:** Vercel functions in `/api` (Node runtime)
- **Lint:** ESLint from the Vite template

Deploy to **Vercel** (HTTPS is required for camera, location, NFC and QR). For phone testing during development, use **ngrok** or **Cloudflare Tunnel**.

---

## 4. Design direction (the most important section)

**The feel:** warm, human, calm and premium, like a beautifully made health product, not a hospital form. It should be confident and quiet: lots of space, few words, big real photography, soft depth. Every screen should look intentionally designed.

### Colour palette: "Warm Ember"

Define as CSS variables and use only these:

| Token        | Hex                    | Use                                              |
| ------------ | ---------------------- | ------------------------------------------------ |
| `--ink`      | `#24140E`              | Main text, dark surfaces                         |
| `--cocoa`    | `#4A2618`              | Dark section backgrounds, hero gradient start    |
| `--ember`    | `#E8833A`              | Primary accent, active states, **the pain glow** |
| `--amber`    | `#F4B263`              | Gradient end, highlights                         |
| `--ivory`    | `#FBF6EE`              | App background                                   |
| `--sand`     | `#F2E5D2`              | Alternate sections, soft card fills              |
| `--line`     | `#E6D8C4`              | Borders and dividers                             |
| `--muted`    | `#7A685B`              | Secondary text                                   |
| `--verified` | `#2F7D5B` on `#E3F1EA` | Doctor-verified badge, "yes" tick                |
| `--self`     | `#9A6412` on `#FBEFD9` | Self-reported badge                              |
| `--alert`    | `#D64531`              | Emergency only, "no" cross                       |

The ember/amber glow is the brand's signature, and it's the **same glow** used on the mannequin's pain pin. Use the warm gradient (`--cocoa` → `--ember` → `--amber`) for heroes and key moments only.

### Typography

- Plus Jakarta Sans. Display: 600 weight, tracking -0.03em, `clamp()` sizes (hero about 56–72 px on desktop). Body: 16–18 px, line-height 1.55.
- Eyebrow labels: JetBrains Mono, 11–12 px, uppercase, letter-spacing 0.12em, inside a thin outlined pill (as in the reference).
- Maximum 2 lines for any heading on patient screens. Patient-facing labels: 1–3 words.

### Shape, depth and components

- Radius: 28 px for photo cards, 20 px for cards, full pill for buttons and chips.
- **Primary button:** a pill with label plus a circular icon chip on the right (like the reference), ember fill or ivory fill on dark.
- **Glass cards on photos:** `backdrop-blur`, white at about 12% opacity, 1 px light border. Use on heroes.
- Soft shadows only (large blur, low opacity, warm-tinted). No harsh borders.
- 8 px spacing grid. Generous whitespace.
- **Picture card (core component):** a square real photo, rounded 24 px, with a 1–3 word label underneath; when selected, an ember ring and a small tick badge; press animation (scale 0.97). Minimum tap target 96 px; on patient screens aim for 140–200 px cards.
- **Big answer buttons:** huge tick (verified green) and cross (alert red) circles, at least 120 px, used whenever the patient answers yes or no.

### Layout and responsiveness

- Mobile-first. Must look excellent at 375 px (phone), 820 px (tablet portrait), 1180 px (tablet landscape, the hospital demo) and 1440 px (desktop).
- Patient screens: one question per screen, picture grid of 2 columns on phone, 3–4 on tablet, centred with max width.
- Hospital mode on tablet landscape: a **split view**, with patient content on the left (about 60%, pictures) and the doctor panel on the right (about 40%, text, voice, controls). On a phone, it becomes a toggle between "Patient" and "Doctor" tabs.

### Don'ts

No emoji. No cartoons or clip-art. No stock icons as patient content. No walls of text. No generic SaaS gradients, purple, or default Tailwind blue. No decorative elements without a purpose. No images used just to fill space.

---

## 5. Data and architecture

The emergency page opens on a **stranger's phone**, so patient data must live on a server.

**Supabase tables:**

- `patients`: `id` (uuid, used in the card URL), `photo_url`, `name` (nullable), `help_phone`, `help_name` (nullable), `consented_at`, `created_at`
- `facts`: `id`, `patient_id`, `type` (condition | allergy | medicine | blood_group | event_history | body_fact), `value`, `status` (self_reported | doctor_verified), `verified_by` (doctor id), `verified_at`
- `visits`: `id`, `patient_id` (nullable for walk-in), `doctor_id`, `started_at`, `ended_at`, `transcript` (JSON list of patient statements and doctor questions/answers), `summary`
- `doctors`: `id`, `name`, `mdcn_number`, `verified` (boolean), `pin` (hashed)
- `briefings`: `patient_id`, `language` (en | yo | ig | ha), `text_hash`, `audio_url`, `created_at`
- `alerts`: `patient_id`, `sent_at`, `lat`, `lng` (for rate-limiting)

**Storage bucket:** `briefings/` for the cached MP3s, and `photos/` for patient photos.

**Security (keep it simple but sensible):** the browser only uses the anon key with row-level security. All writes of verified facts and all emergency reads go through `/api` functions using the service role key. The emergency endpoint returns **only** the briefing subset (photo, name, verified facts, unverified facts, help phone, audio URLs), never visit transcripts. The device that created a patient stores the patient id and a secret token locally (zustand persist) to edit its own record.

**Seed data:**

- Doctor: "Dr. Ngozi Okafor", MDCN verified, PIN `1234`
- Demo patient (seeded and also creatable live): help phone `DEMO_HELP_PHONE`; facts: asthma (doctor-verified), allergy to penicillin (doctor-verified), blood group O+ (doctor-verified), fainting sometimes (self-reported)

---

## 6. Asset map (use exactly these files)

All paths are under `/assets/voxcare/`. Clips are MP4 with a matching `<name>-poster.webp`. Create `src/data/assets.ts`, a typed catalogue with `id`, `src`, `poster?`, `label` (patient label, 1–3 words), `sentence` (for the sentence builder) and `doctorText`.

| Folder       | Files                                                                                                                                                                                  | Used in                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `body/`      | `body-front`, `body-back`                                                                                                                                                              | Body map (the only mannequin images; the app draws the glow and pins)    |
| `ui/`        | `consent-private`, `consent-allow`, `consent-delete`                                                                                                                                   | Consent screen (3 pictures)                                              |
| `ui/`        | `setup-photo`, `setup-dial`, `help-family`, `nfc-tap`, `intro-card`                                                                                                                    | Setup and card screens                                                   |
| `ui/`        | `demo-tap.mp4`, `practice-done`, `doctor-gestures`                                                                                                                                     | Teaching the patient in Hospital mode                                    |
| `ui/`        | `talk-doctor`, `doctor-questions`, `intro-doctor`, `intro-family`, `hospital-tablet`                                                                                                   | Home, Allow screen, landing page                                         |
| `ui/`        | `pain`, `allergy-medicine`, `other`                                                                                                                                                    | "What do you want to say?" cards                                         |
| `ui/`        | `consent`, `photo-camera`, `photo-gallery`                                                                                                                                             | Secondary use (thumbs up = "I understand"; photo source choice)          |
| `feelings/`  | `level-0` … `level-4`                                                                                                                                                                  | How bad (calm face → crying face)                                        |
| `feelings/`  | `sad`, `worried`, `scared`, `angry`, `confused`                                                                                                                                        | Feelings grid                                                            |
| `feel/`      | `fever`, `chills`, `weak-tired`, `swelling-legs`, `swelling-face`, `rash`, `itching`, `nosebleed`, `bleeding-cut`, `cough`, `diarrhoea`, `no-appetite`, `cant-sleep`, `blurred-vision` | "How my body feels" grid                                                 |
| `events/`    | `fall`, `faint`, `dizzy`, `breathless`, `choking`, `vomit`, `cough-blood`, `stroke-signs`, `bladder` (MP4 + poster)                                                                    | "Something happened" grid (muted looping clips)                          |
| `facts/`     | `pregnant`, `wheelchair`, `walking-stick`, `crutches`, `glasses`, `hearing-aid`, `artificial-limb`, `unsafe`                                                                           | "Add more about me"; `unsafe` = "I don't feel safe" in the feelings grid |
| `questions/` | `q-where`, `q-how-long`, `q-allergy`, `q-medicine`, `q-pregnant`, `q-eaten`, `q-fever`, `q-vomit`, `q-breathing`, `q-before`                                                           | Doctor's picture questions                                               |
| `questions/` | `i-blood-test`, `i-injection`, `i-xray`, `i-medicine-twice`, `i-come-back`                                                                                                             | Doctor's picture instructions                                            |

**Extra photos for the landing page only:** you may use a few high-quality **Unsplash** photos (free licence) for the landing hero and story sections: warm, natural light, Black/Nigerian people, everyday or clinic settings, and **nobody shown as sick or in distress**. Prefer our own assets where they fit, so the characters stay consistent. Download them into `public/assets/landing/` (don't hotlink) and credit photographers in the footer.

**Video rules:** `muted loop playsInline preload="none"` with the poster; only autoplay clips visible on screen (IntersectionObserver); pause when off screen.

---

## 7. Screens and flows

### 7.1 Landing page (`/`)

For judges and hospitals. Premium, warm, photographic, inspired by the reference.

- **Hero:** warm cocoa-to-ember gradient with a large photo (`talk-doctor` or an Unsplash clinic photo); an eyebrow pill ("Healthcare without barriers"); headline e.g. _"Speak without a voice."_; one line of support text; two pill buttons: **"Get my VoxCare card"** (→ `/start`) and **"Hospital mode"** (→ `/hospital`). A glass card on the photo shows a live mini mannequin with a pulsing ember pin and the sentence _"I have a sharp pain in my right knee."_
- **The problem:** one short sentence plus one strong image.
- **How it works:** 3 steps with real images: _Set up in 20 seconds_ (`setup-photo`), _Talk to any doctor_ (`intro-doctor`), _Your phone speaks in an emergency_ (`nfc-tap`).
- **Languages:** "Briefings in English, Yorùbá, Igbo and Hausa", with a play button sample.
- **Trust:** private by default, doctor-verified facts, you can delete anytime (reuse the consent images).
- **Footer:** minimal.
  Keep it short: 5 sections maximum.

### 7.2 Setup (patient alone, about 20 seconds)

Every setup screen starts with a large picture or a short animated hint (a hand doing the action), a 1–3 word title, and one primary button. Progress dots at the top.

1. **Consent** (`/start`): three picture cards in a row (stacked on phone) using `consent-private` ("Private"), `consent-allow` ("You allow"), `consent-delete` ("Delete anytime"). Then a large checkbox card "I agree" (green tick when checked). Primary button disabled until checked.
2. **Me** (`/setup/me`): large circular photo slot with `setup-photo` as the hint. Buttons: **Camera** (`getUserMedia` selfie with a capture button) and **Gallery** (file input). A clear **Skip** button. An optional "Name (optional)" text field, small and secondary.
3. **Help person** (`/setup/help`): `help-family` image with the caption "If you need help, we tell them." Then a **big digits-only dial pad** (like the phone dialler: large keys, backspace, number displayed large; Nigerian format, accept 0XXXXXXXXXX or +234). If the Contact Picker API is supported, also show "Pick from contacts". Optional small "Their name (optional)" field.
4. **Check** (`/setup/check`): big WhatsApp button opening `https://wa.me/<number>?text=This is a test from VoxCare. You are my help person.`. When the user returns, show big tick ("It's them") and cross ("Dial again").
5. **Your card** (`/card`): the VoxCare card as a beautiful object: warm gradient, the photo (or a soft silhouette), the name if given, "Deaf · uses pictures", a QR code to `https://<domain>/e/<patientId>`. Below it, the `nfc-tap` image with "Tap here in an emergency" and a **"Write to NFC sticker"** button (Web NFC `NDEFReader.write` with the URL record; show it only where supported, i.e. Android Chrome, otherwise show instructions to use a free NFC writer app with the URL and a copy button). "Go home" button.

Save to Supabase at the end of step 3; trigger briefing generation (section 8) in the background.

### 7.3 Home (`/home`)

Two large picture cards only: **Talk to a doctor** (`talk-doctor`) and **My card** (live mini card). A small "Add more about me" link opens an optional grid of `facts/*` (saved as self-reported). A small settings icon (lucide) for staff mode. **No Help button.**

### 7.4 Hospital mode: the core demo (`/hospital`)

**Start:** the doctor taps **"Scan patient card"** (QR via camera, or NFC read where supported) or **"New walk-in visit"**. If scanning, the patient's screen shows `intro-doctor` with the doctor's name and a "MDCN verified" badge, plus big **Allow** (tick) and **No** (cross). Doctor login is a simple PIN screen (seeded doctor).

**Teach (no words):**

1. `demo-tap.mp4` plays large, looping, with a big next arrow.
2. **Practice tap:** `body-front` with the head highlighted, an animated hand icon sliding and tapping, and a pulsing ring. On tap: ember glow, then `practice-done` full screen for 1 second.

**Patient side: "What do you want to say?"** A 2 × 2 grid of large picture cards:

- **Pain** (`pain`) → body map
- **How I feel** (`feel/fever`) → body-feelings grid
- **Something happened** (`events/faint` poster) → events grid (looping clips)
- **Feelings** (`feelings/worried`) → feelings grid, plus `facts/unsafe` as "Not safe"

Smaller cards under it: **Allergy or medicine** (`allergy-medicine`) and **Other** (`other`). A persistent **"Done"** button sends everything to the doctor panel.

**Body map (the hero interaction; make it excellent):**

- Shows `body-front` (flip button to `body-back`) on a dark charcoal stage matching the image background.
- Tap: a **pin drops** at the exact point with a spring animation; a radial ember/amber glow pulses; a glass label appears naming the body part ("Right knee").
- Pins are draggable; positions stored as percentages; up to 3 pins.
- Region detection uses polygons in percentage coordinates **calibrated to these two images**: head, face, jaw, ear L/R, throat, neck, shoulder L/R, chest, upper stomach, lower stomach, pelvis, upper arm L/R, elbow L/R, forearm L/R, hand L/R, upper back, lower back, buttocks, hip L/R, thigh L/R, knee L/R, calf/shin L/R, ankle L/R, foot L/R. Left/right is the **patient's** side (front view: the patient's right is the viewer's left). Build a hidden `?debug=regions` overlay to draw the polygons for calibration.
- After a pin: **Kind of pain** = 5 cards, each a cropped live view of the mannequin at the pin with a different CSS glow: _pressing_ (wide steady), _burning_ (flickering), _sharp_ (small bright point with rays), _throbbing_ (expanding rings), _cramping_ (twisting knot). Then **How bad** = `level-0..4` faces in a row with a warm gradient bar under them. Then **How long** = a days stepper (big − / +) with quick picks: Today, A few days, A week, Longer.

**Sentence builder:** combines everything into natural English, e.g. _"I have a sharp pain in my right knee. It is very bad. It started 3 days ago. I also have a fever and I feel dizzy."_ Write unit tests for 15+ combinations to keep the grammar natural.

**Doctor panel (right side, or the Doctor tab on phone):**

- The patient's sentence in large readable text plus a **Speak** button (Web Speech API, English; pre-warm voices).
- Thumbnails of what the patient picked, with the pain pin shown on a small mannequin.
- **Ask with pictures:** a grid of `questions/q-*` with their text ("Are you allergic to any medicine?"). Tapping one shows the picture **full screen on the patient side** with big tick and cross. `q-where` opens the body map. The answer appears in the doctor panel ("Yes, allergic to a medicine") and is spoken.
- **Instructions:** `questions/i-*`. Tapping one shows it full screen to the patient with a big "I understand" tick (uses `ui/consent` as the thumbs-up image).
- **Gestures:** a button showing `doctor-gestures` full screen.
- Optional free-text box: shows the doctor's text large on the patient side with "Show me a picture instead".
- **End visit:** a summary (everything said and answered), then **Verify facts**: the doctor confirms, edits or adds conditions, allergies, medicines and blood group → saved as `doctor_verified` with the doctor's id. Self-reported facts show with the amber badge and a "Confirm" button. Saving triggers briefing regeneration (section 8).

### 7.5 Emergency page (`/e/:patientId`)

Opens from the QR code or NFC on any phone, no login, loads fast (separate lightweight route chunk).

- **On load:** `POST /api/alert` with `patientId` and the responder's GPS (`navigator.geolocation`, 5 s timeout; send without it if denied). Show a green banner when sent: **"Family has been told."**
- **Top:** the patient's photo (or silhouette) and name if given; a red pill "EMERGENCY · DEAF · CANNOT SPEAK".
- **A huge "Play briefing" button** (audio needs one tap). It plays English → Yorùbá → Igbo → Hausa in sequence, with language chips highlighting the current one; tapping a chip jumps to that language.
- **Verified facts** as large cards (green badge), then **Not yet confirmed** (amber badge).
- **"Ask the patient"**: the same picture questions with big tick and cross, so the responder can communicate.
- **Big Call button** to the help person (`tel:`), plus "Send location on WhatsApp".
- High contrast and large text, readable in sunlight.

---

## 8. Voice briefing with YarnGPT (cached)

**Briefing text template (English)**, generated from verified data:

> "Emergency information for {name | the owner of this phone}. This person is Deaf and cannot speak. They cannot hear you. Face them, use gestures, and show them the pictures on this screen. Do not shout, and do not assume they are unconscious because they do not respond to sound. Their family has already been alerted. Doctor-verified information: {each verified fact; allergies phrased as 'They are allergic to penicillin. Do not give penicillin.'}. {If any: 'Not yet confirmed by a doctor: …'} Press the green button on screen to call their family."

**`/api/briefing` (server only, never expose the key):**

- Languages: `en`, `yo`, `ig`, `ha`. Send the English text for `en`; for the others send the same English text with `target_language` set to `yo` / `ig` / `ha` (YarnGPT translates before speaking).
- Request: `POST https://api.yarngpt.ai/api/v1/tts`, headers `Authorization: Bearer ${YARNGPT_API_KEY}`, `Idempotency-Key: <cacheKey>`, `Content-Type: application/json`, body `{ text, voice, output_format: "mp3", target_language? }`. It returns `202` with `job_id`. Poll `GET https://api.yarngpt.ai/api/v1/status/{job_id}` every 1.5 s until `status === "completed"`, then **immediately download** `audio_url` (it expires in about an hour) and upload it to Supabase Storage `briefings/<cacheKey>.mp3`.
- Voices: call `GET https://api.yarngpt.ai/api/v1/voices` once, choose one voice per language, and store the choices in config.
- **Cache key** = `sha256(text + language + voice)`. Before any API call, check the `briefings` table and storage; if it exists, reuse it. Only call YarnGPT when the text actually changes. Log each real API call.
- Triggered in the background after setup and after a doctor saves verified facts, so audio is ready **before** any emergency.
- The emergency page caches the 4 MP3s via the service worker for offline replay. If audio is missing, fall back to `speechSynthesis` in English.

## 9. Automatic family alert

**`/api/alert`:** looks up the patient's help phone; sends an SMS via **Termii** (`TERMII_API_KEY`, `TERMII_SENDER_ID`): _"VoxCare alert: {name or 'Your family member'} needs help. Someone is with them now. Location: https://maps.google.com/?q={lat},{lng}"_ (omit the location line if none). Rate-limit: at most one alert per patient every 10 minutes (use the `alerts` table). Return success so the page can show "Family has been told."

---

## 10. Quality bar and definition of done

**Functionality (test on a real phone and tablet over HTTPS):**

- [ ] Setup works end to end with no typing; skipping the photo works; the WhatsApp check opens correctly.
- [ ] The card shows a working QR code; NFC writing works on Android Chrome.
- [ ] Hospital mode: demo clip → practice tap → body map (accurate regions, both sides, left/right correct) → kind of pain → how bad → how long → natural sentence spoken aloud.
- [ ] The doctor asks a picture question, the patient answers with tick/cross, and the answer is shown and spoken.
- [ ] The doctor verifies facts, and the briefing regenerates (cached; no repeat API calls for unchanged text).
- [ ] Scanning the QR code or tapping NFC on another phone opens `/e/:id`, sends the SMS, shows "Family has been told", and plays the briefing in 4 languages.
- [ ] Works offline after the first load (except the SMS and new audio generation).

**Design:**

- [ ] Every screen looks intentional at 375, 820, 1180 and 1440 px widths.
- [ ] Only the palette colours are used; consistent radii, spacing and type scale.
- [ ] No emoji, no clutter, labels of 1–3 words on patient screens.
- [ ] Smooth, subtle motion; `prefers-reduced-motion` respected.

**Engineering:**

- [ ] TypeScript strict; reusable components (`PictureCard`, `AnswerButtons`, `BodyMap`, `PillButton`, `Eyebrow`, `GlassCard`, `ClipCard`, `VoxCard`); a typed asset catalogue.
- [ ] Lighthouse: Performance 90+ and Accessibility 95+ on mobile; initial JS under 200 KB gzipped; images lazy-loaded with width and height set.
- [ ] Accessible: alt text on every image, visible focus states, ARIA labels on icon buttons, good colour contrast.
- [ ] A `README` with setup steps, env vars, the Supabase SQL schema with seed data, and deploy steps.

Build in this order so the demo-critical path works first: **design system → body map and sentence builder → Hospital mode (patient + doctor) → emergency page + alert + briefing → setup and card → landing page → polish.**
