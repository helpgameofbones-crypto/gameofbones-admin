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

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', yesterday.toISOString())
    .lt('created_at', today.toISOString())
    .order('created_at', { ascending: true })

  const orderList = orders || []

  const csvRows = [
    ['Order Ref', 'Date', 'Customer', 'Phone', 'City', 'State', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Payment', 'Status', 'AWB'],
    ...orderList.map(o => [
      o.ref,
      new Date(o.created_at).toLocaleDateString('en-IN'),
      o.customer_name,
      o.customer_phone,
      o.shipping_address?.city || '',
      o.shipping_address?.state || '',
      (o.items || []).map((i: any) => `${i.qty}x ${i.name}`).join(' | '),
      o.subtotal || 0,
      o.discount || 0,
      o.shipping || 0,
      o.grand_total,
      o.payment_method?.toUpperCase(),
      o.status,
      o.delhivery_awb || ''
    ])
  ]

  const csv = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="orders-${yesterday.toISOString().split('T')[0]}.csv"`
    }
  })
}