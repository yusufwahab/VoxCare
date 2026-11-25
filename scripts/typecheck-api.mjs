// Type-checks the backend (api/, server/, test/). Part of `npm run build`.
// Vercel builds only the frontend and does not upload api/ (.vercelignore), so there it is skipped.
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

if (!existsSync('api/tsconfig.json')) {
  if (process.env.VERCEL) {
    console.log('typecheck:api skipped: api/ is not part of the Vercel frontend upload')
    process.exit(0)
  }
  console.error('typecheck:api: api/tsconfig.json not found')
  process.exit(1)
}
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const r = spawnSync(process.execPath, [tsc, '-p', 'api/tsconfig.json'], { stdio: 'inherit' })
process.exit(r.status ?? 1)
