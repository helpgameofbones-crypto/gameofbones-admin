// Shared browser Supabase client. Uses @supabase/ssr's createBrowserClient so
// the session is stored in a cookie (not localStorage). This is required so
// that middleware.ts and requireAdmin.ts — which both read the session from
// request cookies via createServerClient — see the same logged-in session
// that gets created here after a successful login. Using the plain
// createClient() from @supabase/supabase-js instead would persist the
// session to localStorage only, which the server-side cookie checks can
// never see, causing admin API calls to fail with 401 Unauthorized even
// though the user appears logged in in the browser.
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
