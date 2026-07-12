import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REF_RE = /^[A-Za-z0-9-]{3,40}$/
const PHONE_RE = /^\+?\d{10,13}$/

function isValidItems(items: any): items is any[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return false
  return items.every((item) =>
    item &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' && !Number.isNaN(item.price) &&
    typeof item.quantity === 'number' && !Number.isNaN(item.quantity)
  )
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const order = await req.json()

    if (!order.ref || !order.customer_phone) {
      return NextResponse.json({ error: 'Missing required fields: ref, customer_phone' }, { status: 400, headers })
    }
    if (!REF_RE.test(order.ref)) {
      return NextResponse.json({ error: 'Invalid ref format' }, { status: 400, headers })
    }
    if (!PHONE_RE.test(order.customer_phone)) {
      return NextResponse.json({ error: 'Invalid customer_phone format' }, { status: 400, headers })
    }
    if (!isValidItems(order.items)) {
      return NextResponse.json({ error: 'Invalid items: must be an array of 1-50 items each with name, price, quantity' }, { status: 400, headers })
    }

    const insertData: Record<string, any> = {
      ref: order.ref,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      items: order.items,
      total_amount: order.total_amount,
      shipping: order.shipping,
      discount: order.discount,
      grand_total: order.grand_total,
      payment_method: order.payment_method,
      shipping_address: order.shipping_address,
      notes: order.notes,
    }

    if (order.payment_method === 'cod') {
      insertData.payment_status = 'pending_cod'
      insertData.status = 'confirmed'
    } else {
      insertData.payment_status = 'pending'
      insertData.status = 'pending_payment'
    }

    const { error, data } = await supabase.from('orders').insert([insertData]).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }

    fetch('https://gameofbones-admin.vercel.app/api/order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    }).catch(e => console.log('Email send skipped:', e))

    return NextResponse.json({ success: true, order: data }, { status: 201, headers })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders(req) })
  }
}
