import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const [customers, orders, subscriptions, products] = await Promise.all([
    database().from('customers').select('*').order('total_spent', { ascending: false }).limit(5000),
    database().from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    database().from('subscriptions').select('*').order('created_at', { ascending: false }).limit(5000),
    database().from('products').select('id,name,price,product_sizes(*)').eq('is_active', true).order('name').limit(1000),
  ])
  if (customers.error || orders.error || subscriptions.error || products.error) return NextResponse.json({ error: 'Unable to load customer intelligence data.' }, { status: 500 })
  try { return NextResponse.json({ customers: customers.data || [], orders: (orders.data || []).map(revealOrderForAdmin), subscriptions: subscriptions.data || [], products: products.data || [] }) }
  catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { action?: unknown; rows?: unknown; keepPhone?: unknown; removePhone?: unknown; subscription?: unknown } | null
  const db = database()
  if (body?.action === 'import') {
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []
    const valid = rows.map(row => {
      const data = row as Record<string, unknown>
      return { name: typeof data.name === 'string' ? data.name.trim().slice(0, 200) : '', phone: typeof data.phone === 'string' ? data.phone.trim().slice(0, 30) : '', email: typeof data.email === 'string' ? data.email.trim().slice(0, 320) || null : null, city: typeof data.city === 'string' ? data.city.trim().slice(0, 100) || null : null, state: typeof data.state === 'string' ? data.state.trim().slice(0, 100) || null : null }
    }).filter(row => row.name && row.phone)
    if (!valid.length) return NextResponse.json({ error: 'No valid customer rows were provided.' }, { status: 400 })
    const phones = [...new Set(valid.map(row => row.phone))]
    const { data: existing, error: existingError } = await db.from('customers').select('phone').in('phone', phones)
    if (existingError) return NextResponse.json({ error: 'Unable to check existing customers.' }, { status: 500 })
    const existingPhones = new Set((existing || []).map(row => row.phone))
    const insert = valid.filter(row => !existingPhones.has(row.phone)).map(row => ({ ...row, total_orders: 0, total_spent: 0 }))
    if (insert.length) {
      const { error } = await db.from('customers').insert(insert)
      if (error) return NextResponse.json({ error: 'Unable to import customers.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, imported: insert.length })
  }
  if (body?.action === 'merge') {
    if (typeof body.keepPhone !== 'string' || typeof body.removePhone !== 'string' || body.keepPhone === body.removePhone) return NextResponse.json({ error: 'Choose two different customers to merge.' }, { status: 400 })
    const { data: records } = await db.from('customers').select('*').in('phone', [body.keepPhone, body.removePhone])
    const keep = (records || []).find(record => record.phone === body.keepPhone), remove = (records || []).find(record => record.phone === body.removePhone)
    if (!keep || !remove) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    const { error: updateError } = await db.from('customers').update({ total_orders: Number(keep.total_orders || 0) + Number(remove.total_orders || 0), total_spent: Number(keep.total_spent || 0) + Number(remove.total_spent || 0), notes: [keep.notes, remove.notes].filter(Boolean).join(' | ') }).eq('id', keep.id)
    if (updateError) return NextResponse.json({ error: 'Unable to merge customer records.' }, { status: 500 })
    const { error: deleteError } = await db.from('customers').delete().eq('id', remove.id)
    if (deleteError) return NextResponse.json({ error: 'Customer merge is incomplete; source record was not deleted.' }, { status: 500 })
    return NextResponse.json({ ok: true, mergedName: remove.name, keepName: keep.name })
  }
  if (body?.action === 'subscription') {
    const subscription = body.subscription as Record<string, unknown> | null
    if (!subscription || typeof subscription.customer_phone !== 'string' || typeof subscription.product_id !== 'string') return NextResponse.json({ error: 'A customer and product are required.' }, { status: 400 })
    const [{ data: customer }, { data: product }] = await Promise.all([
      db.from('customers').select('name,email').eq('phone', subscription.customer_phone).maybeSingle(),
      db.from('products').select('name,price,product_sizes(*)').eq('id', subscription.product_id).maybeSingle(),
    ])
    if (!customer || !product) return NextResponse.json({ error: 'Customer or product not found.' }, { status: 404 })
    const sizeLabel = typeof subscription.size_label === 'string' ? subscription.size_label.slice(0, 100) : ''
    const size = Array.isArray(product.product_sizes) ? product.product_sizes.find((entry: { label?: string }) => entry.label === sizeLabel) : null
    const frequency = Number(subscription.frequency_days)
    const frequencyDays = Number.isInteger(frequency) ? Math.min(Math.max(frequency, 7), 365) : 30
    const nextOrderDate = typeof subscription.next_order_date === 'string' && !Number.isNaN(Date.parse(subscription.next_order_date)) ? subscription.next_order_date : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const { error } = await db.from('subscriptions').insert({ customer_phone: subscription.customer_phone, customer_name: customer.name || '', customer_email: customer.email || '', product_id: subscription.product_id, product_name: product.name || '', size_label: sizeLabel, price: Number(size?.price || product.price || 0), frequency_days: frequencyDays, next_order_date: nextOrderDate, is_active: true })
    if (error) return NextResponse.json({ error: 'Unable to create subscription.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported customer action.' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; is_active?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'A subscription and active state are required.' }, { status: 400 })
  const { error } = await database().from('subscriptions').update({ is_active: body.is_active }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update subscription.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
