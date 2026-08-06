import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_FN_URL = 'https://syuostlqzzinigqwjzap.supabase.co/functions/v1'

// Cron job (see vercel.json) — automatically syncs order status from Delhivery
// tracking (placed/confirmed/dispatched/shipped/delivered/etc.) into Supabase.
// This calls the same sync-delhivery-status Supabase Edge Function that the
// "Sync All Statuses" button on /delhivery-sync already triggers manually —
// before this route existed, that button was the ONLY way statuses ever
// updated, so orders sat on stale statuses until someone opened the admin
// panel and clicked it by hand. Runs every 3 hours; safe to call repeatedly,
// the underlying function just re-checks each non-final order against
// Delhivery's tracking API and updates rows whose status actually changed.
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  try {
        const res = await fetch(`${SUPABASE_FN_URL}/sync-delhivery-status`, { method: 'POST' })
        const data = await res.json()
        return NextResponse.json({ ok: true, ...data })
  } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
