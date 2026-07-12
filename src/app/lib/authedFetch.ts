'use client'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabase = createClient(
  SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fallback: read the session token directly out of localStorage using
// Supabase's default storage key format (sb-<project-ref>-auth-token).
// This app briefly ends up with more than one GoTrueClient instance in the
// same tab (one on the page itself, one here), and in that situation
// supabase.auth.getSession() has been observed to resolve with no session
// even though a valid one is sitting in storage. Reading storage directly
// sidesteps that entirely.
function getTokenFromStorage(): string | null {
  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.access_token || parsed?.currentSession?.access_token || null
  } catch {
    return null
  }
}

// Use this instead of the raw fetch() for any call to an admin-only API
// route (razorpay, manual-order, delhivery, orders, email-captures,
// dog-birthday, send-birthday-email, send-campaign, analytics/*). This
// app's browser client stores the Supabase session in localStorage, not in
// a cookie, so a plain fetch() carries no auth information the server can
// see — requireAdmin() on the server side checks for this Bearer token.
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token || null
  } catch {
    // fall through to storage read below
  }
  if (!token) token = getTokenFromStorage()

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...options, headers })
}
