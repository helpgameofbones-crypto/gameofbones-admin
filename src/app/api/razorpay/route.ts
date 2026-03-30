import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KEY_ID     = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const AUTH       = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')
const BASE       = 'https://api.razorpay.com/v1'

async function rzpFetch(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json()

    if (action === 'get_payments') {
      const { from, to, count } = data || {}
      const params = new URLSearchParams({
        count: count || '100',
        ...(from && { from: Math.floor(new Date(from).getTime() / 1000).toString() }),
        ...(to   && { to:   Math.floor(new Date(to).getTime()   / 1000).toString() }),
      })
      const result = await rzpFetch(`/payments?${params}`)
      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'get_payment') {
      const result = await rzpFetch(`/payments/${data.payment_id}`)
      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'refund') {
      const { payment_id, amount, notes } = data
      const result = await rzpFetch(`/payments/${payment_id}/refund`, 'POST', {
        amount: amount * 100,
        notes: { reason: notes || 'Refund requested' }
      })
      if (result.id) {
        await supabase.from('activity_log').insert({
          action:      'refund issued',
          entity_type: 'payment',
          entity_id:   payment_id,
          details:     `Rs ${amount} refunded. Refund ID: ${result.id}`,
        })
      }
      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'get_orders') {
      const params = new URLSearchParams({ count: '100' })
      const result = await rzpFetch(`/orders?${params}`)
      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'get_settlements') {
      const result = await rzpFetch('/settlements')
      return NextResponse.json({ ok: true, data: result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}