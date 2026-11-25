import { route, baseUrl } from './_lib/http.js'
import { HttpError, env } from './_lib/env.js'
import { sendAlertEmail } from './_lib/email.js'

/** Dev only: sends a sample alert email to DEMO_HELP_EMAIL. Disabled in production. */
export default route(async (req) => {
  if (process.env.VERCEL_ENV === 'production') throw new HttpError(404, 'Not found')
  await sendAlertEmail({
    to: env('DEMO_HELP_EMAIL'),
    patientName: 'Chinedu',
    photoUrl: null,
    helpName: 'Test',
    lat: 6.5244,
    lng: 3.3792,
    emergencyUrl: `${baseUrl(req)}/e/demo`,
  })
  return { sent: true, to: process.env.DEMO_HELP_EMAIL }
})
