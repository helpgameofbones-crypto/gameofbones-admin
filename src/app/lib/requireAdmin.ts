import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isAllowedAdmin(email: string | null | undefined): boolean {
  const configured = process.env.ADMIN_EMAILS
  if (!configured) return false
  const allowed = configured.split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  return Boolean(email && allowed.includes(email.toLowerCase()))
}

function forbidden() {
  return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearerToken) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(bearerToken)
    if (user && isAllowedAdmin(user.email)) return null
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAllowedAdmin(user.email)) return forbidden()

  return null
}
