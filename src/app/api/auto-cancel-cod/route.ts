import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fortyEightHoursAgo = new Date()
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

  const { data: unconfirmedOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'placed')
    .eq('payment_method', 'cod')
    .lt('created_at', fortyEightHoursAgo.toISOString())

  let cancelled = 0

  for (const order of (unconfirmedOrders || [])) {
    await supabase
      .from('orders')
      .update({ status: 'cancelled', notes: 'Auto-cancelled: COD not confirmed in 48 hours' })
      .eq('id', order.id)

    await supabase.from('activity_log').insert({
      action: 'order auto-cancelled (COD unconfirmed 48h)',
      entity_type: 'order',
      entity_id: order.id,
      entity_name: order.ref,
    })

    if (order.customer_email) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: order.customer_email,
        subject: `Your order ${order.ref} has been cancelled`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a1008;padding:24px;text-align:center">
              <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            </div>
            <div style="background:#f9f6f2;padding:32px">
              <h2 style="color:#1a1008">Order Cancelled</h2>
              <p style="color:#6b7280">Hi ${order.customer_name},</p>
              <p style="color:#6b7280">Your order <strong>${order.ref}</strong> has been cancelled as we were unable to confirm your COD order within 48 hours.</p>
              <p style="color:#6b7280">If you still want to order, please place a new order at gameofbones.in</p>
              <div style="text-align:center;margin-top:24px">
                <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">
                  Order Again →
                </a>
              </div>
            </div>
          </div>
        `
      })
    }

    cancelled++
  }

  return NextResponse.json({ ok: true, cancelled })
}