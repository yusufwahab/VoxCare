/**
 * Dummy environment for every test run. Vitest applies these over anything loaded from .env,
 * and test/setup.ts refuses to start if any of them is different, so a test can never use a real key.
 */
export const TEST_ENV: Record<string, string> = {
  YARNGPT_API_KEY: 'test-yarngpt-key',
  BREVO_API_KEY: 'test-brevo-key',
  BREVO_SENDER_EMAIL: 'sender@example.test',
  BREVO_SENDER_NAME: 'VoxCare',
  DEMO_HELP_EMAIL: 'help@example.test',
  DEMO_HELP_PHONE: '2348000000000',
  DEMO_MODE: 'false',
  DEMO_WHATSAPP_NUMBER: '',
  // .invalid never resolves, so even an unmocked client could not reach a real project
  SUPABASE_URL: 'https://supabase.test.invalid',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  FRONTEND_URL: 'https://app.test.invalid',
  VITE_API_URL: '',
}
