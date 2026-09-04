import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

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

    const decryptedEmail = revealLegacyPii(order.customer_email)
    if (decryptedEmail) {
      // Wrapped in try/catch so one bad send doesn't stop the rest of the
      // batch from being cancelled — cancellation above already happened
      // regardless of whether the email succeeds.
      try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: decryptedEmail,
        subject: `Your order ${order.ref} has been cancelled`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a1008;padding:24px;text-align:center">
              <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            </div>
            <div style="background:#f9f6f2;padding:32px">
              <h2 style="color:#1a1008">Order Cancelled</h2>
              <p style="color:#6b7280">Hi ${revealLegacyPii(order.customer_name)},</p>
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
      } catch (e) {
        console.error('Auto-cancel email failed for', order.ref, e)
      }
    }

    cancelled++
  }

  return NextResponse.json({ ok: true, cancelled })
}
