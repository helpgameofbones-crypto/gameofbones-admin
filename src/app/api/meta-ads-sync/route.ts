import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID // format: act_1234567890
const META_API_VERSION = 'v19.0'

function findActionValue(actions: any[] | undefined, matchSubstr: string): number {
  if (!Array.isArray(actions)) return 0
  const hit = actions.find((a) => (a.action_type || '').includes(matchSubstr))
  return hit ? parseFloat(hit.value) || 0 : 0
}

// Cron job (see vercel.json) — runs once daily and pulls the PREVIOUS day's
// Meta Ads spend/performance per campaign from Meta's Marketing API, logging
// it into the same `ad_spend` table the Marketing page's manual "Log Ad
// Spend" form already writes to. Once this is connected, ad spend just shows
// up automatically instead of anyone typing Meta's numbers in by hand.
//
// Requires two env vars that don't exist yet on a fresh setup:
//   META_ACCESS_TOKEN  - a long-lived token with the `ads_read` permission
//   META_AD_ACCOUNT_ID - the ad account to pull from, formatted "act_123456789"
// Until both are set, this route just reports that Meta isn't connected yet
// rather than failing loudly — safe to deploy before ads are actually running.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return NextResponse.json({
      ok: false,
      connected: false,
      message: 'Meta Ads is not connected yet — set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Vercel env vars, then this will start working with no code changes.',
    })
  }

  // Pull YESTERDAY's numbers, not today's — Meta's own reporting for the
  // current day is usually still incomplete/settling, so today's spend can
  // look artificially low if pulled too early.
  const yesterday = new Date(Date.now() - 86400000)
  const dateStr = yesterday.toISOString().split('T')[0]

  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }))
  const url = `https://graph.facebook.com/${META_API_VERSION}/${META_AD_ACCOUNT_ID}/insights` +
    `?level=campaign` +
    `&fields=campaign_name,spend,impressions,clicks,actions,action_values` +
    `&time_range=${timeRange}` +
    `&access_token=${META_ACCESS_TOKEN}`

  let metaData: any
  try {
    const res = await fetch(url)
    metaData = await res.json()
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Failed to reach Meta: ${e.message}` }, { status: 500 })
  }

  if (metaData.error) {
    return NextResponse.json({ ok: false, error: metaData.error.message || 'Meta API error', raw: metaData.error }, { status: 400 })
  }

  const campaigns = metaData.data || []
  let logged = 0
  const results: any[] = []

  for (const c of campaigns) {
    const spend = parseFloat(c.spend) || 0
    if (spend <= 0) continue // nothing worth logging for a campaign with no spend that day

    const campaignName = c.campaign_name || 'Unnamed Campaign'

    // Skip if this exact campaign+date was already logged — makes the cron
    // safe to re-run (or retried by Vercel) without creating duplicate rows.
    const { data: existing } = await supabase
      .from('ad_spend')
      .select('id')
      .eq('date', dateStr)
      .eq('platform', 'meta')
      .eq('campaign_name', campaignName)
      .maybeSingle()

    if (existing) {
      results.push({ campaign: campaignName, skipped: 'already logged for this date' })
      continue
    }

    // Meta's action_type naming varies by pixel/catalog setup (purchase,
    // omni_purchase, offsite_conversion.fb_pixel_purchase, etc.) — match on
    // any action type containing "purchase" rather than one exact string.
    const purchases = findActionValue(c.actions, 'purchase')
    const revenue    = findActionValue(c.action_values, 'purchase')

    await supabase.from('ad_spend').insert({
      date: dateStr,
      platform: 'meta',
      campaign_name: campaignName,
      amount: spend,
      impressions: parseInt(c.impressions) || 0,
      clicks: parseInt(c.clicks) || 0,
      orders_attributed: Math.round(purchases),
      revenue_attributed: revenue,
      notes: 'Auto-synced from Meta Ads',
    })

    logged++
    results.push({ campaign: campaignName, spend, purchases, revenue })
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    date: dateStr,
    campaigns_found: campaigns.length,
    logged,
    results,
  })
}
