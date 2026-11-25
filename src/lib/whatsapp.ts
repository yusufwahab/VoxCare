const flag = (import.meta.env.DEMO_MODE as string | undefined) ?? ''
export const DEMO_MODE = flag.toLowerCase() === 'true'
const DEMO_NUMBER = ((import.meta.env.DEMO_WHATSAPP_NUMBER as string | undefined) ?? '').replace(/[^\d]/g, '')

/**
 * The only place a WhatsApp link is built: https://wa.me/<number>?text=<encoded text>.
 * In demo mode the given number is ignored and DEMO_WHATSAPP_NUMBER is used, so the
 * demo always opens a chat with a teammate. The saved number is still used for the Call button.
 */
export function whatsappLink(number: string, text: string): string {
  const target = DEMO_MODE && DEMO_NUMBER ? DEMO_NUMBER : number.replace(/[^\d]/g, '')
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`
}
