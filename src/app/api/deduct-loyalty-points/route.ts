import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

const { data: orders, error: fetchError } = await supabase
  .from('orders')
  .select('id, ref, customer_id, customer_name, loyalty_points_redeemed, loyalty_points_deducted')
  .gt('loyalty_points_redeemed', 0)
  .or('loyalty_points_deducted.is.null,loyalty_points_deducted.eq.false')
  .limit(200)

if (fetchError) {
  return NextResponse.json({ error: fetchError.message }, { status: 500 })
}

let deducted = 0
  const results: any[] = []

    for (const order of (orders || [])) {
      try {
        if (!order.customer_id) {
          results.push({ ref: order.ref, skipped: 'order has no linked customer_id' })
          continue
        }

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone, loyalty_points')
        .eq('id', order.customer_id)
        .maybeSingle()

      if (!customer) {
        results.push({ ref: order.ref, skipped: 'no customer row for order.customer_id' })
        continue
      }

      const pointsToDeduct = order.loyalty_points_redeemed || 0
        const newBalance = Math.max((customer.loyalty_points || 0) - pointsToDeduct, 0)

      await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customer.id)

      await supabase.from('loyalty_ledger').insert({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        type: 'redeemed',
        points: -pointsToDeduct,
        balance_after: newBalance,
        order_ref: order.ref,
        description: `Redeemed at checkout on order ${order.ref}`,
      })

      await supabase.from('orders').update({ loyalty_points_deducted: true }).eq('id', order.id)

      await supabase.from('activity_log').insert({
        action: 'loyalty points redeemed',
        entity_type: 'customer',
        entity_id: customer.id,
        entity_name: customer.name,
        details: `-${pointsToDeduct} points — redeemed at checkout on order ${order.ref}`,
      })

      deducted++
        results.push({ ref: order.ref, customer: customer.name, pointsDeducted: pointsToDeduct, newBalance })
      } catch (e: any) {
        results.push({ ref: order.ref, error: e.message })
      }
    }

return NextResponse.json({
  ok: true,
  orders_checked: orders?.length || 0,
  deducted,
  results,
})
}
