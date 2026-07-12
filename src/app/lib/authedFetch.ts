'use client'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Use this instead of the raw fetch() for any call to an admin-only API
// route (razorpay, manual-order, delhivery, orders, email-captures,
// dog-birthday, send-birthday-email, send-campaign, analytics/*). This
// app's browser client stores the Supabase session in localStorage, not in
// a cookie, so a plain fetch() carries no auth information the server can
// see — requireAdmin() on the server side checks for this Bearer token.
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  return fetch(url, { ...options, headers })
}
