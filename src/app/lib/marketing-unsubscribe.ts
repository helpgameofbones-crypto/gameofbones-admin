import { createHmac, timingSafeEqual } from 'node:crypto'
import { piiHash } from '@/app/lib/pii-crypto'

type UnsubscribePayload = { emailHash: string; expiresAt: number }

function secret() {
  const value = process.env.GOB_ACCOUNT_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('Email preferences are not configured')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(`marketing-unsubscribe:${payload}`).digest('base64url')
}

export function createMarketingUnsubscribeToken(email: string) {
  const emailHash = piiHash(email.trim().toLowerCase())
  if (!emailHash) throw new Error('A valid email is required for marketing preferences')
  const payload = Buffer.from(JSON.stringify({ emailHash, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyMarketingUnsubscribeToken(token: string | null): UnsubscribePayload | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UnsubscribePayload
    return /^[a-f0-9]{64}$/.test(value.emailHash) && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() ? value : null
  } catch {
    return null
  }
}

export function marketingUnsubscribeUrl(email: string) {
  return `https://gameofbones.in/api/marketing/unsubscribe?token=${encodeURIComponent(createMarketingUnsubscribeToken(email))}`
}
