import { createHmac, timingSafeEqual } from 'node:crypto'

type CustomerSession = { phone: string; expiresAt: number }

function secret() {
  const value = process.env.GOB_ACCOUNT_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('Customer account sessions are not configured')
  return value
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function customerOtpHash(phone: string, code: string) {
  return createHmac('sha256', secret()).update(`otp:${phone}:${code}`).digest('hex')
}

export function createCustomerSession(phone: string) {
  const payload = Buffer.from(JSON.stringify({ phone, expiresAt: Date.now() + 1000 * 60 * 60 * 8 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyCustomerSession(token: string | null): CustomerSession | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CustomerSession
    // New checkout data always uses a ten-digit mobile number. A small set of
    // legacy customer profiles, however, contain a short numeric identifier
    // from the old importer. They may sign in only after proving control of
    // their email through the one-time code flow, so keep those accounts able
    // to see their own historical orders and reward balance.
    return /^\d{3,13}$/.test(session.phone) && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now() ? session : null
  } catch { return null }
}

export function customerSessionFromRequest(request: Request) {
  const header = request.headers.get('authorization')
  return verifyCustomerSession(header?.startsWith('Bearer ') ? header.slice(7) : null)
}
