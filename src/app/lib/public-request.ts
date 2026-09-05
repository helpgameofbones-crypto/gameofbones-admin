import { NextRequest, NextResponse } from 'next/server'

const TRUSTED_ORIGINS = new Set([
  'https://gameofbones.in',
  'https://www.gameofbones.in',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'https://gameofbones-website-git-storefront-staging-gameofbones.vercel.app',
])

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rejectUnexpectedOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  // Browser calls must originate from the storefront. Requests without an
  // Origin header are allowed for server-to-server callbacks, which need
  // their own authentication.
  if (origin && !TRUSTED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Untrusted origin' }, { status: 403 })
  }
  return null
}

export function rateLimit(req: NextRequest, scope: string, limit: number, windowMs: number) {
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${scope}:${address}`
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (current.count >= limit) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)) },
    })
  }
  current.count += 1
  return null
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
