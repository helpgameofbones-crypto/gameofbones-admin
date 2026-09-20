import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { createDelhiveryShipment } from '@/app/lib/delhivery-shipment'
import { requireAdmin } from '@/app/lib/requireAdmin'

const statusValues = new Set(['placed', 'confirmed', 'dispatched', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'])

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function reconcileReadyShipments() {
  const token = process.env.DELHIVERY_API_TOKEN
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!token) return

  const db = database()
  const { data: candidates } = await db.from('orders').select('*')
    .is('delhivery_awb', null)
    .in('status', ['confirmed'])
    .order('created_at', { ascending: true })
    .limit(20)

  for (const candidate of candidates || []) {
    let order = candidate
    try {
      if (order.payment_method === 'razorpay') {
        if (!order.transaction_id || !keyId || !keySecret) continue
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const payment = await razorpay.payments.fetch(order.transaction_id) as { status?: string }
        if (payment.status !== 'captured') continue
        const { data: paidOrder, error } = await db.from('orders')
          .update({ payment_status: 'paid', status: 'confirmed' })
          .eq('id', order.id).select('*').maybeSingle()
        if (error || !paidOrder) continue
        order = paidOrder
      } else if (order.payment_method !== 'cod' || !['pending_cod', 'confirmed'].includes(String(order.payment_status || ''))) {
        continue
      }
      await createDelhiveryShipment({ order, orderId: order.id })
    } catch (error) {
      // One delayed or malformed order must never block the remaining queue.
      console.error('[admin-orders] automatic shipment reconciliation failed', { orderId: order.id, error })
    }
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  // Reconcile a small, safe queue before rendering. This repairs a rare
  // Razorpay-webhook/browser race while preserving Delhivery idempotency.
  await reconcileReadyShipments()

  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || '200')
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200
  const { data, error } = await database().from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 })

  try {
    // Older orders may contain an undecodable legacy phone/email value while
    // their linked customer profile is intact. Prefer that verified profile
    // only when the order value is clearly not usable; never overwrite data.
    const customerIds = [...new Set((data || []).map(row => typeof row.customer_id === 'string' ? row.customer_id : '').filter(Boolean))]
    const { data: customerRows } = customerIds.length
      ? await database().from('customers').select('id,name,phone,email').in('id', customerIds)
      : { data: [] as Array<{ id: string; name: string | null; phone: string | null; email: string | null }> }
    const customers = new Map((customerRows || []).map(customer => [customer.id, customer]))
    const validPhone = (value: unknown) => /^\+?\d{10,13}$/.test(String(value || '').replace(/[\s-]/g, ''))
    const validEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
    const orders = (data || []).map(row => {
      const readable = revealOrderForAdmin(row)
      const customer = typeof row.customer_id === 'string' ? customers.get(row.customer_id) : undefined
      return {
        ...readable,
        customer_name: String(readable.customer_name || '').trim() || customer?.name || '',
        customer_phone: validPhone(readable.customer_phone) ? readable.customer_phone : (customer?.phone || ''),
        customer_email: validEmail(readable.customer_email) ? readable.customer_email : (customer?.email || ''),
      }
    })
    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Admin order decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => null) as { ids?: unknown; updates?: Record<string, unknown> } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 200) : []
  const updates = body?.updates || {}
  if (!ids.length) return NextResponse.json({ error: 'Select at least one order.' }, { status: 400 })

  const safeUpdates: Record<string, unknown> = {}
  if (typeof updates.status === 'string' && statusValues.has(updates.status)) safeUpdates.status = updates.status
  if (typeof updates.delivered_at === 'string') safeUpdates.delivered_at = updates.delivered_at
  if (Array.isArray(updates.order_notes)) safeUpdates.order_notes = updates.order_notes.slice(-100)
  if (updates.is_refunded === true) safeUpdates.is_refunded = true
  if (typeof updates.refund_amount === 'number' && Number.isFinite(updates.refund_amount) && updates.refund_amount >= 0) safeUpdates.refund_amount = updates.refund_amount
  if (typeof updates.refund_reason === 'string') safeUpdates.refund_reason = updates.refund_reason.slice(0, 500)
  if (typeof updates.refunded_at === 'string') safeUpdates.refunded_at = updates.refunded_at
  if (!Object.keys(safeUpdates).length) return NextResponse.json({ error: 'No permitted order changes were supplied.' }, { status: 400 })

  const { error } = await database().from('orders').update(safeUpdates).in('id', ids)
  if (error) return NextResponse.json({ error: 'Unable to update order.' }, { status: 500 })
  if (safeUpdates.is_refunded) {
    await database().from('activity_log').insert({
      action: 'refund processed', entity_type: 'order', entity_id: ids.join(','),
      entity_name: ids.length === 1 ? ids[0] : `${ids.length} orders`,
      details: `Refund of ₹${safeUpdates.refund_amount ?? 0} recorded through the protected admin API.`,
    })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => null) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 200) : []
  if (!ids.length) return NextResponse.json({ error: 'Select at least one order.' }, { status: 400 })

  const { error } = await database().from('orders').delete().in('id', ids)
  if (error) return NextResponse.json({ error: 'Unable to delete order.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
