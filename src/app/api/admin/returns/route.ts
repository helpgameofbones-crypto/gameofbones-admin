import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

const statuses = new Set(['requested', 'approved', 'rejected', 'completed'])
const WINDOW_HOURS = 48
function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const [returns, orders] = await Promise.all([
    database().from('returns').select('*').order('created_at', { ascending: false }).limit(2000),
    database().from('orders').select('*').order('created_at', { ascending: false }).limit(500),
  ])
  if (returns.error || orders.error) return NextResponse.json({ error: 'Unable to load return data.' }, { status: 500 })
  try { return NextResponse.json({ returns: returns.data || [], orders: (orders.data || []).map(revealOrderForAdmin) }) }
  catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { order_ref?: unknown; reason?: unknown; refund_amount?: unknown; notes?: unknown } | null
  if (typeof body?.order_ref !== 'string' || !body.order_ref.trim() || typeof body.reason !== 'string' || !body.reason.trim()) return NextResponse.json({ error: 'Order reference and reason are required.' }, { status: 400 })
  const ref = body.order_ref.trim().toUpperCase()
  const { data: rawOrder } = await database().from('orders').select('*').ilike('ref', ref).limit(1).maybeSingle()
  const order = rawOrder ? revealOrderForAdmin(rawOrder) : null
  const deliveredAt = order?.delivered_at ? new Date(String(order.delivered_at)).getTime() : 0
  const isException = !order || order.status !== 'delivered' || !deliveredAt || Date.now() - deliveredAt > WINDOW_HOURS * 36e5
  const refundAmount = typeof body.refund_amount === 'number' ? body.refund_amount : Number(body.refund_amount || 0)
  if (!Number.isFinite(refundAmount) || refundAmount < 0) return NextResponse.json({ error: 'Refund amount must be valid.' }, { status: 400 })
  const { error } = await database().from('returns').insert({
    order_id: order?.id || null, order_ref: ref, customer_name: order?.customer_name || '', customer_phone: order?.customer_phone || '',
    reason: body.reason.trim().slice(0, 500), refund_amount: refundAmount, notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '',
    items: order?.items || [], status: 'requested', source: 'admin', is_exception: isException,
  })
  if (error) return NextResponse.json({ error: 'Unable to log return.' }, { status: 500 })
  return NextResponse.json({ ok: true, isException })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.status !== 'string' || !statuses.has(body.status)) return NextResponse.json({ error: 'A valid return and status are required.' }, { status: 400 })
  const { data: record, error: lookupError } = await database().from('returns').select('order_id').eq('id', body.id).maybeSingle()
  if (lookupError || !record) return NextResponse.json({ error: 'Return request not found.' }, { status: 404 })
  const { error } = await database().from('returns').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update return.' }, { status: 500 })
  if (body.status === 'approved' && record.order_id) await database().from('orders').update({ status: 'rto' }).eq('id', record.order_id)
  return NextResponse.json({ ok: true })
}
