'use client'
import { supabase } from '@/app/lib/supabaseBrowserClient'

// Legacy fallback: some older sessions may still have a token sitting in
// localStorage from before this app switched to the cookie-backed
// createBrowserClient (see supabaseBrowserClient.ts). Harmless to keep as a
// secondary check — costs nothing if it finds nothing.
function getTokenFromStorage(): string | null {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
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
// dog-birthday, send-birthday-email, send-campaign, analytics/*).
// The session cookie set by createBrowserClient is same-origin, so a plain
// fetch() to these routes would actually carry it automatically — but we
// also attach it as a Bearer token here since requireAdmin() checks for
// that first, and it's a safe belt-and-suspenders against cookie edge cases.
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
