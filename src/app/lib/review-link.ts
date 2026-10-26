import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { customerSessionFromRequest } from '@/app/lib/customer-session'

/* One-tap review links.
   The review-request email carries an opaque random token (nothing personal in the URL).
   Only its SHA-256 is stored. The website exchanges it for a short-lived, review-only
   session that can list and submit reviews and nothing else (no account, orders or points). */

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const LINK_DAYS = 45
const SESSION_MS = 1000 * 60 * 60 * 2
const SITE = 'https://gameofbones.in'

function secret() {
  const value = process.env.GOB_ACCOUNT_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('Customer account sessions are not configured')
  return value
}
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const sign = (value: string) => createHmac('sha256', secret()).update(`review:${value}`).digest('base64url')

/** Creates a link token for this phone and returns the full review URL, or the account page if anything fails. */
export async function createReviewLink(phone: string): Promise<string> {
  if (!/^\d{10}$/.test(phone)) return `${SITE}/account`
  try {
    const token = randomBytes(24).toString('base64url')
    const { error } = await db.from('review_link_tokens').insert({ token_hash: sha(token), phone, expires_at: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString() })
    if (error) throw error
    return `${SITE}/review?t=${token}`
  } catch (error) {
    console.error('Review link creation failed', error)
    return `${SITE}/account`
  }
}

/** Exchanges a link token for a review-only session token. */
export async function exchangeReviewLink(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const { data, error } = await db.from('review_link_tokens').select('id,phone,expires_at').eq('token_hash', sha(token)).maybeSingle()
  if (error || !data || new Date(data.expires_at).getTime() < Date.now()) return null
  await db.from('review_link_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  const payload = Buffer.from(JSON.stringify({ phone: data.phone, scope: 'review', expiresAt: Date.now() + SESSION_MS })).toString('base64url')
  return `r.${payload}.${sign(payload)}`
}

function verifyReviewSession(token: string | null) {
  if (!token?.startsWith('r.')) return null
  const [, payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload)), received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { phone: string; scope: string; expiresAt: number }
    return session.scope === 'review' && /^\d{10}$/.test(session.phone) && session.expiresAt > Date.now() ? { phone: session.phone, expiresAt: session.expiresAt } : null
  } catch { return null }
}

/** For the review endpoints only: accepts a normal signed-in session or a review-only session. */
export function reviewSessionFromRequest(request: Request) {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  return verifyReviewSession(token) || customerSessionFromRequest(request)
}
