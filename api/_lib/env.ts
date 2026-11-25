export class HttpError extends Error {
  constructor(public status: number, message: string, public headers?: Record<string, string>) {
    super(message)
  }
}

export function env(name: string, required = true): string {
  const v = process.env[name]
  if (!v && required) throw new HttpError(500, `Missing environment variable ${name}`)
  return v ?? ''
}

/** True on the live deployment (Render sets NODE_ENV=production; Vercel sets VERCEL_ENV). */
export const isProduction = () => process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
