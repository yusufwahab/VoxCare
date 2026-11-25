import { createLimiter } from './rateLimit.js'

/**
 * Abuse limits per endpoint (in memory, single instance: see rateLimit.ts). Keys come from clientKey().
 * Reading emergency information (GET /api/emergency) is never limited; only actions that cost money or
 * notify someone are.
 */
const MIN = 60_000

/** POST /api/patient: each new patient starts 4 paid YarnGPT jobs. A family may set up a few phones. */
export const PATIENT_CREATE = { limit: 5, windowMs: 60 * MIN }
/** All clients together: caps the YarnGPT spend if many addresses are used. */
export const PATIENT_CREATE_GLOBAL = { limit: 100, windowMs: 60 * MIN }
/** POST /api/briefing: cached when facts did not change, paid when they did. */
export const BRIEFING = { limit: 10, windowMs: 10 * MIN }
/** POST /api/join (joining and replacement links). */
export const JOIN = { limit: 10, windowMs: 15 * MIN }
/** POST /api/alert per client. Generous: one responder's phone may help several people. */
export const ALERT_CLIENT = { limit: 10, windowMs: 10 * MIN }
/** POST /api/alert per patient: one email every 10 minutes (the database check also survives restarts). */
export const ALERT_PATIENT = { limit: 1, windowMs: 10 * MIN }

export const limiters = {
  patientCreate: createLimiter(PATIENT_CREATE),
  patientCreateGlobal: createLimiter(PATIENT_CREATE_GLOBAL),
  briefing: createLimiter(BRIEFING),
  join: createLimiter(JOIN),
  alertClient: createLimiter(ALERT_CLIENT),
  alertPatient: createLimiter(ALERT_PATIENT),
}
