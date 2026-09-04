import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const text = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const number = (value: unknown, max = 100_000_000) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0 }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const resource = request.nextUrl.searchParams.get('resource'); const db = database()
  if (resource === 'production') { const { data, error } = await db.from('production_batches').select('*').order('date', { ascending: false }).limit(5000); if (error) return NextResponse.json({ error: 'Unable to load production batches.' }, { status: 500 }); return NextResponse.json({ items: data || [] }) }
  if (resource === 'influencers') { const [influencers, sends] = await Promise.all([db.from('influencers').select('*').order('created_at', { ascending: false }).limit(5000), db.from('influencer_sends').select('*').order('sent_date', { ascending: false }).limit(5000)]); if (influencers.error || sends.error) return NextResponse.json({ error: 'Unable to load influencer data.' }, { status: 500 }); return NextResponse.json({ influencers: influencers.data || [], sends: sends.data || [] }) }
  if (resource === 'audit') { const { data, error } = await db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200); if (error) return NextResponse.json({ error: 'Unable to load audit history.' }, { status: 500 }); return NextResponse.json({ items: data || [] }) }
  return NextResponse.json({ error: 'Unknown operations resource.' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>; const db = database()
  if (body.action === 'production') {
    const date = text(body.date, 10), batchName = text(body.batch_name, 300); if (!batchName || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Batch name and date are required.' }, { status: 400 })
    const { error } = await db.from('production_batches').insert({ batch_name: batchName, batch_id: text(body.batch_id, 100), start_time: text(body.start_time, 20), end_time: text(body.end_time, 20), price_per_kg: number(body.price_per_kg), total_kg: number(body.total_kg), transportation: number(body.transportation), notes: text(body.notes), date, price: number(body.price), total_cost: number(body.total_cost), run_time_hours: number(body.run_time_hours, 48), run_time: text(body.run_time, 50), total_grams: number(body.total_grams), yield_g: number(body.yield_g), yield_pct: number(body.yield_pct, 100) })
    if (error) return NextResponse.json({ error: 'Unable to save production batch.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (body.action === 'influencer') {
    const name = text(body.name, 200), instagram = text(body.instagram_handle, 200).replace(/^@/, ''); if (!name || !instagram) return NextResponse.json({ error: 'Name and Instagram handle are required.' }, { status: 400 })
    const type = ['barter', 'paid'].includes(String(body.collab_type)) ? String(body.collab_type) : 'barter'
    const { error } = await db.from('influencers').insert({ name, instagram_handle: instagram, phone: text(body.phone, 50), email: text(body.email, 320), address: text(body.address), collab_type: type, payment_amount: type === 'paid' ? number(body.payment_amount) : null, notes: text(body.notes) })
    if (error) return NextResponse.json({ error: 'Unable to save influencer.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (body.action === 'influencer-send') {
    const id = text(body.influencer_id, 100), items = text(body.items, 2000), date = text(body.sent_date, 10); if (!id || !items || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Influencer, items, and date are required.' }, { status: 400 })
    const { data: influencer } = await db.from('influencers').select('name').eq('id', id).maybeSingle()
    const { error } = await db.from('influencer_sends').insert({ influencer_id: id, items, value: number(body.value), sent_date: date, tracking_awb: text(body.tracking_awb, 100), notes: text(body.notes) })
    if (error) return NextResponse.json({ error: 'Unable to log influencer send.' }, { status: 500 })
    await db.from('activity_log').insert({ action: 'influencer send logged', entity_type: 'influencer', entity_id: id, entity_name: influencer?.name || '', details: `Sent: ${items}` })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported operations action.' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const id = request.nextUrl.searchParams.get('id') || ''; if (!id) return NextResponse.json({ error: 'Influencer id is required.' }, { status: 400 })
  const db = database(); await db.from('influencer_sends').delete().eq('influencer_id', id); const { error } = await db.from('influencers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete influencer.' }, { status: 500 }); return NextResponse.json({ ok: true })
}
