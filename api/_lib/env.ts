export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function env(name: string, required = true): string {
  const v = process.env[name]
  if (!v && required) throw new HttpError(500, `Missing environment variable ${name}`)
  return v ?? ''
}
