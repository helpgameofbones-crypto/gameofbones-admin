import { NextRequest, NextResponse } from 'next/server'
import { sendDeliveredEmail, sendDispatchEmail, sendOrderPlacedEmail, sendOutForDeliveryEmail } from '@/app/lib/lifecycle-emails'

export const dynamic = 'force-dynamic'

// This is a one-time, owner-approved production preview. It is reachable only
// through the project's existing CRON_SECRET, sends to a fixed recipient, and
// never creates or changes an order or customer record.
const TEST_RECIPIENT = 'sahuanjan6@gmail.com'

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const order = {
    customer_email: TEST_RECIPIENT,
    customer_name: 'Anjan Sahu',
    ref: 'TEST-EMAIL-20260930',
    subtotal: 1_200,
    discount: 190,
    coupon_code: 'WELCOME15',
    loyalty_points_redeemed: 100,
    packaging: 0,
    grand_total: 980,
    delhivery_awb: 'TEST123456789',
    items: [
      { product_name: 'Chicken Jerky', pack_label: '100g', pack_price: 450, quantity: 1 },
      { product_name: 'Goat Trotter', pack_label: '1 piece', pack_price: 450, quantity: 1 },
      { product_name: 'Whole Mackerel', pack_label: '100g', pack_price: 300, quantity: 1 },
    ],
  }
  try {
    const results = await Promise.all([
      sendOrderPlacedEmail(order),
      sendDispatchEmail(order, order.delhivery_awb),
      sendOutForDeliveryEmail(order),
      sendDeliveredEmail(order),
    ])
    return NextResponse.json({ ok: true, sent: results.filter(Boolean).length })
  } catch (error) {
    console.error('[test-order-lifecycle-emails] failed', error)
    return NextResponse.json({ error: 'Preview delivery failed.' }, { status: 502 })
  }
}
