import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Shared helper for API routes to enforce that the caller has a valid,
// logged-in Supabase session. Call this as the first line of every
// admin-only API route handler.
//
// IMPORTANT: this app's browser-side Supabase client is created with plain
// createClient() from @supabase/supabase-js, which persists the session in
// localStorage — NOT in a cookie. A cookie-only check (the original version
// of this file) can never see that session and will 401 every legitimate
// logged-in request. The primary check here is therefore a Bearer token
// (the client's current access_token, attached by src/app/lib/authedFetch.ts
// — use that instead of raw fetch() when calling any admin-only route from
// a client component). The cookie-based check is kept as a fallback in case
// a call site is ever migrated to @supabase/ssr's cookie-synced
// createBrowserClient.
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearerToken) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(bearerToken)
    if (user) return null
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // No-op: we're not returning a response that can set cookies here,
          // we only need to read the session to authorize the request.
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
