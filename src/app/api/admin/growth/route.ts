import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const text = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const amount = (value: unknown, max = 100_000_000) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0 }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const resource = request.nextUrl.searchParams.get('resource'); const db = database()
  if (resource === 'referrals') {
    const { data, error } = await db.from('referrals').select('*').order('created_at', { ascending: false }).limit(5000)
    if (error) return NextResponse.json({ error: 'Unable to load referrals.' }, { status: 500 }); return NextResponse.json({ items: data || [] })
  }
  if (resource === 'marketing') {
    const [spend, links] = await Promise.all([db.from('ad_spend').select('*').order('date', { ascending: false }).limit(5000), db.from('utm_links').select('*').order('created_at', { ascending: false }).limit(5000)])
    if (spend.error || links.error) return NextResponse.json({ error: 'Unable to load marketing data.' }, { status: 500 }); return NextResponse.json({ ad_spend: spend.data || [], utm_links: links.data || [] })
  }
  return NextResponse.json({ error: 'Unknown growth resource.' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>; const db = database()
  if (body.resource === 'ad-spend') {
    const date = text(body.date, 10), platform = text(body.platform, 100), campaign = text(body.campaign_name, 300)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !platform) return NextResponse.json({ error: 'Campaign date and platform are required.' }, { status: 400 })
    const { error } = await db.from('ad_spend').insert({ date, platform, campaign_name: campaign, amount: amount(body.amount), impressions: Math.floor(amount(body.impressions, 1_000_000_000)), clicks: Math.floor(amount(body.clicks, 1_000_000_000)), orders_attributed: Math.floor(amount(body.orders_attributed, 1_000_000)), revenue_attributed: amount(body.revenue_attributed), notes: text(body.notes, 2000) })
    if (error) return NextResponse.json({ error: 'Unable to save advertising spend.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (body.resource === 'utm') {
    const name = text(body.name, 300), baseUrl = text(body.base_url, 2000), source = text(body.utm_source, 300)
    if (!name || !source || !/^https?:\/\//.test(baseUrl)) return NextResponse.json({ error: 'A name, source, and valid website URL are required.' }, { status: 400 })
    const query = new URLSearchParams(); for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) { const value = text(body[key], 300); if (value) query.set(key, value) }
    const fullUrl = `${baseUrl.split('?')[0]}?${query.toString()}`
    const { error } = await db.from('utm_links').insert({ name, base_url: baseUrl, utm_source: source, utm_medium: text(body.utm_medium, 300), utm_campaign: text(body.utm_campaign, 300), utm_content: text(body.utm_content, 300), full_url: fullUrl })
    if (error) return NextResponse.json({ error: 'Unable to save tracking link.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported growth action.' }, { status: 400 })
}
