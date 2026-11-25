# AGENTS.md

Instructions for AI agents and engineers working on VoxCare. Read this, then `.agent/handoff.md`.

## Project

VoxCare helps Deaf and speech-impaired people in Nigeria talk to doctors and first responders with pictures. Hackathon build.

- **Requirements:** [voxcare_build_prompt.md](voxcare_build_prompt.md). Setup, env vars and deploy: [README.md](README.md).
- **Frontend:** Vite + React 19 + TypeScript, Tailwind v4, zustand, PWA (`src/`). Deployed on Vercel.
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

## Rules

- Work on `dev` (tracks `origin/dev`). PR target is `main`. Never modify `main`, force-push, merge or deploy without explicit approval.
- Standing approval: after each independently completed and verified feature, make a conventional commit (body: what, why, files, verification) and push to `origin/dev`. Never push failing or incomplete work.
- Check before every commit: `npx vitest run`, `npx eslint .`, `npx tsc -b`, `npx tsc -p api/tsconfig.json`, `npm run build`. Stage only relevant files; scan the staged diff for `.env` values.
- Every security fix or bug fix gets a regression test. Tests use dummy keys and mocks only (README "Tests"); never send real alerts, write to real Supabase or call YarnGPT or Brevo.
- Never print `.env` values (names only). No dependency upgrades, schema migrations or new production env vars without approval.
- Report partial fixes as partial. Keep changes small; no unrelated refactors.
