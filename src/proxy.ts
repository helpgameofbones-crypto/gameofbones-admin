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
export async function proxy(req: NextRequest) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
