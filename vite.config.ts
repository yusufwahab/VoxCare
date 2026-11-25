import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import { TEST_ENV } from './test/env.ts'

/** Dev only: serve the /api functions from this Vite server, using the keys in .env (no Vercel login needed). */
function devApi(): Plugin {
  return {
    name: 'voxcare-dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const m = url.pathname.match(/^\/api\/([\w-]+)$/)
        if (!m) return next()
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const query = Object.fromEntries(url.searchParams)
          const fake = Object.assign(req, { query, body: raw ? JSON.parse(raw) : {} })
          const out = Object.assign(res, {
            status(code: number) { res.statusCode = code; return out },
            json(data: unknown) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)) },
          })
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          await mod.default(fake, out)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }))
        }
      })
    },
  }
}

export default defineConfig({
  envPrefix: ['VITE_', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DEMO_MODE', 'DEMO_WHATSAPP_NUMBER'],
  plugins: [
    devApi(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'VoxCare',
        short_name: 'VoxCare',
        description: 'Communicate with doctors and first responders without speaking, hearing, reading or writing.',
        theme_color: '#24140E',
        background_color: '#FBF6EE',
        display: 'standalone',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        // Emergency data and briefing audio are NOT cached here: src/lib/offline.ts keeps only this phone's own card,
        // with an expiry, and clears it on reset (T16). Never add API or Supabase storage routes to this list.
        runtimeCaching: [
          { urlPattern: /\/assets\/.*\.(webp|jpg|png)$/, handler: 'CacheFirst', options: { cacheName: 'vc-images', expiration: { maxEntries: 400 } } },
          { urlPattern: /\/assets\/.*\.mp4$/, handler: 'CacheFirst', options: { cacheName: 'vc-clips', rangeRequests: true, cacheableResponse: { statuses: [200] } } },
        ],
      },
    }),
  ],
  test: {
    pool: 'vmThreads',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts', 'test/**/*.test.ts'],
    // Blocks the network, fakes Supabase and resets state between tests (see test/setup.ts)
    setupFiles: ['./test/setup.ts'],
    // Dummy values that override anything in .env, so tests never see real keys
    env: TEST_ENV,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
})
