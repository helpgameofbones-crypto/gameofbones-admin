import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Shared helper for API routes to enforce that the caller has a valid,
// logged-in Supabase session — mirrors the cookie-based check in
// src/app/middleware.ts, which only guards page routes (its matcher
// excludes /api/*). Call this as the first line of every admin-only API
// route handler.
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
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
