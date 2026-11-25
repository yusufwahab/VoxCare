/**
 * Call an /api handler directly, the way server/index.ts does, and get back what it sent.
 *
 *   const r = await invoke(handler, { body: { pin: '4821' }, remoteAddress: '203.0.113.7' })
 *   expect(r.status).toBe(200)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

export interface Call {
  method?: string
  url?: string
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
  /** The TCP peer the server sees. Defaults to a public documentation address (203.0.113.0/24). */
  remoteAddress?: string
}

export interface Reply {
  status: number
  // Handlers return JSON of any shape; tests assert on it directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
  headers: Record<string, string>
}

export async function invoke(handler: Handler, call: Call = {}): Promise<Reply> {
  const reply: Reply = { status: 200, body: undefined, headers: {} }
  const req = {
    method: call.method ?? 'POST',
    url: call.url ?? '/api/test',
    headers: Object.fromEntries(Object.entries(call.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
    query: call.query ?? {},
    body: call.body,
    socket: { remoteAddress: call.remoteAddress ?? '203.0.113.10' },
  }
  const res = {
    headersSent: false,
    status(code: number) { reply.status = code; return res },
    json(data: unknown) { reply.body = data; res.headersSent = true; return res },
    setHeader(name: string, value: string | number) { reply.headers[name.toLowerCase()] = String(value); return res },
  }
  await handler(req as unknown as VercelRequest, res as unknown as VercelResponse)
  return reply
}
