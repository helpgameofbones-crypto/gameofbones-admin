import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('customer_phone, customer_name, customer_email, grand_total, created_at, status')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (!orders) return NextResponse.json({ ok: true })

  // Group by phone
  const customers: Record<string, any> = {}
  orders.forEach(o => {
    const phone = o.customer_phone
    if (!phone) return
    if (!customers[phone]) {
      customers[phone] = {
        phone,
        name: o.customer_name,
        email: o.customer_email,
        orders: [],
        total_spent: 0,
        last_order: o.created_at,
      }
    }
    customers[phone].orders.push(o)
    customers[phone].total_spent += o.grand_total || 0
    if (o.created_at > customers[phone].last_order) {
      customers[phone].last_order = o.created_at
    }
  })

  const now = new Date()
  let updated = 0

  for (const c of Object.values(customers)) {
    const orderCount = c.orders.length
    const daysSinceLastOrder = Math.floor((now.getTime() - new Date(c.last_order).getTime()) / (1000 * 60 * 60 * 24))
    const totalSpent = c.total_spent

    let segment = 'new'
    if (orderCount >= 5 || totalSpent >= 5000) segment = 'loyal'
    else if (orderCount >= 2 && daysSinceLastOrder <= 60) segment = 'returning'
    else if (orderCount >= 2 && daysSinceLastOrder > 60) segment = 'at_risk'
    else if (orderCount === 1 && daysSinceLastOrder > 30) segment = 'lapsed'
    else if (orderCount === 1) segment = 'new'

    // Upsert into customers table
    await supabase.from('customers').upsert({
      phone: c.phone,
      name: c.name,
      email: c.email,
      segment,
      total_orders: orderCount,
      total_spent: totalSpent,
      last_order_at: c.last_order,
      days_since_order: daysSinceLastOrder,
    }, { onConflict: 'phone' })
    updated++
  }

  return NextResponse.json({ updated })
}
