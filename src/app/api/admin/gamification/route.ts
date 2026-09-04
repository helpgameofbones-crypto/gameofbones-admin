import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const phone = (value: unknown) => typeof value === 'string' ? value.replace(/\D/g, '').slice(-10) : ''
const couponCode = (prefix: string) => `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const db = database()
  const [customers, orders, rewards, milestones, streaks] = await Promise.all([
    db.from('customers').select('*').order('total_spent', { ascending: false }).limit(5000),
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('rewards').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('milestones').select('*').order('order_count').limit(1000),
    db.from('streaks').select('*').order('current_streak', { ascending: false }).limit(5000),
  ])
  if (customers.error || orders.error || rewards.error || milestones.error || streaks.error) return NextResponse.json({ error: 'Unable to load rewards data.' }, { status: 500 })
  return NextResponse.json({ customers: customers.data || [], orders: (orders.data || []).map(revealOrderForAdmin), rewards: rewards.data || [], milestones: milestones.data || [], streaks: streaks.data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const db = database()
  if (body.action === 'spin') {
    const customerPhone = phone(body.phone); if (!customerPhone) return NextResponse.json({ error: 'A valid customer phone is required.' }, { status: 400 })
    const { data: existing } = await db.from('rewards').select('id').eq('customer_phone', customerPhone).eq('type', 'spin_wheel').limit(1)
    if (existing?.length) return NextResponse.json({ error: 'This customer has already used their spin.' }, { status: 409 })
    const prizes = [{ label: '10% OFF', code: 'SPIN10', value: 10, weight: 30 }, { label: '15% OFF', code: 'SPIN15', value: 15, weight: 25 }, { label: '20% OFF', code: 'SPIN20', value: 20, weight: 20 }, { label: 'Free Ship', code: 'SPINFS', value: 0, weight: 15 }, { label: '25% OFF', code: 'SPIN25', value: 25, weight: 8 }, { label: '30% OFF', code: 'SPIN30', value: 30, weight: 2 }]
    let remaining = Math.random() * 100; let prize = prizes[0]
    for (const option of prizes) { remaining -= option.weight; if (remaining < 0) { prize = option; break } }
    const code = couponCode(prize.code); const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { data: customer } = await db.from('customers').select('name').eq('phone', customerPhone).maybeSingle()
    if (prize.value > 0) { const { error } = await db.from('coupons').insert({ code, type: 'percent', value: prize.value, min_order: 499, max_uses: 1, valid_from: new Date().toISOString().slice(0, 10), valid_until: expiresAt.slice(0, 10), is_active: true }); if (error) return NextResponse.json({ error: 'Unable to create spin coupon.' }, { status: 500 }) }
    const { error } = await db.from('rewards').insert({ customer_phone: customerPhone, customer_name: customer?.name || customerPhone, type: 'spin_wheel', description: prize.label, coupon_code: code, discount_value: prize.value, expires_at: expiresAt })
    if (error) return NextResponse.json({ error: 'Unable to save spin reward.' }, { status: 500 })
    return NextResponse.json({ prize: { ...prize, code }, customer: customer || null })
  }
  if (body.action === 'milestone') {
    const customerPhone = phone(body.phone); if (!customerPhone) return NextResponse.json({ error: 'A valid customer phone is required.' }, { status: 400 })
    const [{ data: customer }, { data: milestone }] = await Promise.all([db.from('customers').select('name,total_orders').eq('phone', customerPhone).maybeSingle(), db.from('milestones').select('*').eq('is_active', true).limit(1000)])
    const match = (milestone || []).find(item => Number(item.order_count) === Number(customer?.total_orders)); if (!customer || !match) return NextResponse.json({ error: 'No active milestone applies to this customer.' }, { status: 400 })
    const code = couponCode(String(match.coupon_code || 'MILESTONE')); const expires = new Date(Date.now() + 7 * 86400000).toISOString()
    if (Number(match.discount_percent) > 0) { const { error } = await db.from('coupons').insert({ code, type: 'percent', value: Number(match.discount_percent), min_order: 0, max_uses: 1, valid_from: new Date().toISOString().slice(0, 10), valid_until: expires.slice(0, 10), is_active: true }); if (error) return NextResponse.json({ error: 'Unable to create milestone coupon.' }, { status: 500 }) }
    const { error } = await db.from('rewards').insert({ customer_phone: customerPhone, customer_name: customer.name || customerPhone, type: 'milestone', description: match.reward_description || 'Milestone reward', coupon_code: code, discount_value: Number(match.discount_percent) || 0 })
    if (error) return NextResponse.json({ error: 'Unable to send milestone reward.' }, { status: 500 })
    return NextResponse.json({ message: `Milestone reward sent to ${customer.name || customerPhone}.` })
  }
  if (body.action === 'streaks') {
    const [customers, orders, existing] = await Promise.all([db.from('customers').select('phone').limit(5000), db.from('orders').select('*').order('created_at', { ascending: false }).limit(5000), db.from('streaks').select('*').limit(5000)])
    if (customers.error || orders.error || existing.error) return NextResponse.json({ error: 'Unable to update streaks.' }, { status: 500 })
    const revealed = (orders.data || []).map(revealOrderForAdmin); const currentMonth = new Date().toISOString().slice(0, 7); const updates: Record<string, unknown>[] = []
    for (const customer of customers.data || []) { const customerPhone = phone(customer.phone); const months = [...new Set(revealed.filter(order => phone(order.customer_phone) === customerPhone).map(order => String(order.created_at || '').slice(0, 7)).filter(Boolean))].sort().reverse(); if (!months.length) continue; let streak = 0; let month = currentMonth; for (const entry of months) { if (entry !== month) break; streak++; const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); month = date.toISOString().slice(0, 7) } if (!streak) continue; const old = (existing.data || []).find(item => phone(item.customer_phone) === customerPhone); updates.push({ customer_phone: customerPhone, current_streak: streak, longest_streak: Math.max(streak, Number(old?.longest_streak || 0)), last_order_month: months[0], updated_at: new Date().toISOString() }) }
    if (updates.length) { const { error } = await db.from('streaks').upsert(updates, { onConflict: 'customer_phone' }); if (error) return NextResponse.json({ error: 'Unable to save streaks.' }, { status: 500 }) }
    return NextResponse.json({ updated: updates.length })
  }
  return NextResponse.json({ error: 'Unsupported rewards action.' }, { status: 400 })
}
