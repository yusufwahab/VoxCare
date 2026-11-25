# AGENTS.md

Instructions for AI agents and engineers working on VoxCare. Read this, then `.agent/handoff.md`.

## Project

VoxCare helps Deaf and speech-impaired people in Nigeria talk to doctors and first responders with pictures. Hackathon build.

- **Requirements:** [voxcare_build_prompt.md](voxcare_build_prompt.md). Setup, env vars and deploy: [README.md](README.md).
- **Frontend:** Vite + React 19 + TypeScript, Tailwind v4, zustand, PWA (`src/`). Deployed on Vercel.
- **Shared:** `shared/` holds code used by both sides (briefing text). Vercel does not upload `api/` or `server/`.
- **Backend:** handlers in `api/` served by plain Node `server/index.ts` on Render. Supabase (service role, RLS on with no policies), YarnGPT (speech), Brevo (email).

## Engineering state

`.agent/` is the persistent record. Update it after every milestone.

| File | Holds |
|---|---|
| [.agent/roadmap.md](.agent/roadmap.md) | T0–T27 with status. Never delete a task; mark it deferred |
| [.agent/progress.md](.agent/progress.md) | Commits, verification log, time budget |
| [.agent/decisions.md](.agent/decisions.md) | Approved and deferred decisions |
| [.agent/blockers.md](.agent/blockers.md) | Blockers, deploy warnings, open security issues |
| [.agent/handoff.md](.agent/handoff.md) | Start here in a new session |
| [docs/requirements-status.md](docs/requirements-status.md) | Spec vs implementation: done, partial, deviations, outstanding |

## Rules

- Work on `dev` (tracks `origin/dev`). PR target is `main`. Never modify `main`, force-push, merge or deploy without explicit approval.
- Standing approval: after each independently completed and verified feature, commit and push to `origin/dev`. Never push failing or incomplete work.
- **Commit messages:** short, plain and professional (e.g. "Fix offline emergency card access", "Add automatic checks for pull requests"), with a concise body. Detailed explanations go in `.agent/` and the completion report. Check the message before pushing.
- **No AI attribution:** no `Co-Authored-By: Claude` trailers, "Generated with Claude Code" footers or other AI signatures in commits or PR descriptions. Claude Code's user settings (`~/.claude/settings.json`) set `attribution.commit` and `attribution.pr` to `""`. Keep the configured Git author identity. Never rewrite existing commits.
- Check before every commit: `npx vitest run`, `npx eslint .`, `npm run typecheck` (frontend + backend), `npm run build`. The same checks run in CI on pull requests into `main` (`.github/workflows/ci.yml`). Stage only relevant files; scan the staged diff for `.env` values.
- Every security fix or bug fix gets a regression test. Tests use dummy keys and mocks only (README "Tests"); never send real alerts, write to real Supabase or call YarnGPT or Brevo.
- Never print `.env` values (names only). No dependency upgrades, schema migrations or new production env vars without approval.
- Report partial fixes as partial. Keep changes small; no unrelated refactors.
- **Offline caching:** never add `/api/*` or Supabase storage routes to the service worker's `runtimeCaching`. Only `src/lib/offline.ts` stores medical data, and only the device's own card.
- **Production protection:** never run migrations against the production Supabase project; write them as SQL files in `supabase/migrations/` with rollback instructions and test them on an isolated database. Never run `npm run dev` or `npm start` with the real `.env`: it holds the production service role key, so local actions write to production data. No significant UI, design or workflow change without explaining it and getting approval. Before pushing `dev`, check what the push triggers (W9, W10 in `.agent/blockers.md`). The goal is a reviewable PR into `main` for the collaborator.
