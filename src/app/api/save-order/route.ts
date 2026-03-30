import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const order = await req.json()

    if (order.payment_method === 'cod' && order.grand_total > 1500) { return NextResponse.json({ error: 'COD not available for orders above Rs 1500. Please pay online.' }, { status: 400 }) }

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, total_orders, total_spent')
      .eq('phone', order.customer_phone)
      .single()

    if (existingCustomer) {
      await supabase
        .from('customers')
        .update({
          total_orders: existingCustomer.total_orders + 1,
          total_spent: existingCustomer.total_spent + order.grand_total,
          name: order.customer_name,
          email: order.customer_email,
          address_line1: order.shipping_address?.line1,
          city: order.shipping_address?.city,
          state: order.shipping_address?.state,
          pincode: order.shipping_address?.pincode,
        })
        .eq('phone', order.customer_phone)
    } else {
      await supabase.from('customers').insert({
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
        address_line1: order.shipping_address?.line1,
        city: order.shipping_address?.city,
        state: order.shipping_address?.state,
        pincode: order.shipping_address?.pincode,
        total_orders: 1,
        total_spent: order.grand_total,
      })
    }

    const { data: savedOrder, error } = await supabase
      .from('orders')
      .insert({
        ref: order.ref,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        shipping_address: order.shipping_address,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount || 0,
        coupon_code: order.coupon_code,
        shipping: order.shipping || 0,
        grand_total: order.grand_total,
        payment_method: order.payment_method,
        payment_status: order.payment_method === 'cod' ? 'pending' : 'paid',
        status: 'placed',
      })
      .select()
      .single()

    if (error) throw error

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    })

    return NextResponse.json({ ok: true, order_id: savedOrder.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


