import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://gameofbones.in',
  'https://www.gameofbones.in',
  'http://localhost:3000',
  'http://localhost:5173',
]

const DEFAULT_ORIGIN = 'https://gameofbones.in'

// CORS allow-list helper for public-facing routes called from the
// customer-facing website. Never reflects an arbitrary origin and never
// uses '*' — if the request's Origin header isn't in the allow-list, we
// fall back to the primary site origin instead.
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_ORIGIN

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}
