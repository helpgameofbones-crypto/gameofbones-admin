import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { exchangeReviewLink } from '@/app/lib/review-link'

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

// Exchanges the one-tap link from a review email for a short, review-only session.
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const originError = rejectUnexpectedOrigin(request); if (originError) return originError
  const limited = await rateLimit(request, 'review-link-exchange', 20, 15 * 60 * 1000); if (limited) return limited
  try {
    const body = await request.json().catch(() => ({})) as { t?: unknown }
    const token = await exchangeReviewLink(cleanText(body.t, 80))
    if (!token) return NextResponse.json({ error: 'This review link has expired. Sign in to leave your review.' }, { status: 401, headers })
    return NextResponse.json({ token }, { headers })
  } catch (error) {
    console.error('Review link exchange failed', error)
    return NextResponse.json({ error: 'Unable to open your review right now.' }, { status: 500, headers })
  }
}
