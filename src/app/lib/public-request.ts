import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TRUSTED_ORIGINS = new Set([
  'https://gameofbones.in',
  'https://www.gameofbones.in',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'https://gameofbones-website-git-storefront-staging-gameofbones.vercel.app',
  'https://gameofbones-website-ctndz06py-gameofbones.vercel.app',
])

function trustedClientAddress(req: NextRequest) {
  // Vercel sets this header at the edge. Do not key a security control directly
  // from a caller-provided x-forwarded-for value when the platform value exists.
  return req.headers.get('x-vercel-forwarded-for')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

function rateLimitClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Rate limiting is not configured')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

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

export async function rateLimit(req: NextRequest, scope: string, limit: number, windowMs: number, identifier?: string) {
  const address = trustedClientAddress(req)
  // A sensitive identifier (such as a normalized phone number) is folded into
  // the server-side hash only. This prevents address rotation from bypassing
  // OTP limits without persisting customer data in the limiter table.
  const subject = createHash('sha256').update(`${scope}:${address}:${identifier || ''}`).digest('hex')
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))

  try {
    const { data: allowed, error } = await rateLimitClient().rpc('consume_request_rate_limit', {
      p_scope: scope,
      p_subject: subject,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) throw error
    if (allowed) return null
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, {
      status: 429,
      headers: { 'Retry-After': String(windowSeconds) },
    })
  } catch (error) {
    console.error('[rate-limit] durable limiter failed', { scope, error })
    // Fail closed: a temporary database failure must not turn sensitive public
    // endpoints (OTP, export, checkout) into an unlimited abuse surface.
    return NextResponse.json({ error: 'This service is briefly unavailable. Please try again shortly.' }, { status: 503 })
  }
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
