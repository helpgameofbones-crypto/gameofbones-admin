import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isAllowedAdmin(email: string | null | undefined) {
  const configured = process.env.ADMIN_EMAILS
  if (!configured || !email) return false
  return configured
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

// Proxy performs the fast, user-facing access check. Every API route that
// reads or mutates private data must still call requireAdmin() as its secure
// authorization boundary.
// Scheduled-job routes authenticate with `Authorization: Bearer <CRON_SECRET>`.
// Checked here once for all of them, failing closed: if CRON_SECRET is not
// set, every request is refused, so "Bearer undefined" can never run a job.
const CRON_ROUTES = new Set([
  '/api/abandoned-cart-followup', '/api/auto-cancel-cod', '/api/award-loyalty-points', '/api/award-referral-points',
  '/api/birthday-emails', '/api/care-library-drip', '/api/customer-segments', '/api/daily-report', '/api/daily-sales',
  '/api/deduct-loyalty-points', '/api/delhivery-sync', '/api/dog-birthday-notification', '/api/low-stock',
  '/api/meta-ads-sync', '/api/nps-survey', '/api/order-reminders', '/api/review-requests', '/api/sheets-sync',
])

function cronAuthorized(header: string | null) {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function proxy(req: NextRequest) {
  const cronPath = req.nextUrl.pathname.replace(/\/$/, '')
  if (CRON_ROUTES.has(cronPath) && req.method === 'GET') {
    return cronAuthorized(req.headers.get('authorization'))
      ? NextResponse.next()
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let response = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: req.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const isLogin = path === '/login'

  if (!user) {
    if (isLogin) return response
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Allow the login screen to remain reachable so an unauthorized Supabase
  // session can be replaced with an approved admin account.
  if (!isAllowedAdmin(user.email)) {
    if (isLogin) return response
    return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
  }

  if (isLogin || path === '/') return NextResponse.redirect(new URL('/dashboard', req.url))
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
    '/api/:job(abandoned-cart-followup|auto-cancel-cod|award-loyalty-points|award-referral-points|birthday-emails|care-library-drip|customer-segments|daily-report|daily-sales|deduct-loyalty-points|delhivery-sync|dog-birthday-notification|low-stock|meta-ads-sync|nps-survey|order-reminders|review-requests|sheets-sync)',
  ],
}
