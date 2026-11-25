/**
 * An error with an HTTP status. Messages of 4xx errors are shown to the client. Messages of 5xx errors
 * are only logged, and the client gets a generic one, unless `expose` is set for a message written for users.
 */
export class HttpError extends Error {
  public expose: boolean
  constructor(public status: number, message: string, public headers?: Record<string, string>, expose?: boolean) {
    super(message)
    this.expose = expose ?? status < 500
  }
}

/** An error message that is safe to log: our own HttpError text, otherwise only the error type */
export const safeMessage = (e: unknown) => (e instanceof HttpError ? e.message : `unexpected ${e instanceof Error ? e.name : typeof e}`)

export const GENERIC_ERROR = 'Something went wrong. Please try again.'

export function env(name: string, required = true): string {
  const v = process.env[name]
  if (!v && required) throw new HttpError(500, `Missing environment variable ${name}`)
  return v ?? ''
}

/** True on the live deployment (Render sets NODE_ENV=production; Vercel sets VERCEL_ENV). */
export const isProduction = () => process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
