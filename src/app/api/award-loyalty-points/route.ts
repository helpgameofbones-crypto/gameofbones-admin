import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const POINTS_EXPIRY_DAYS = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: deliveredOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, ref, customer_id, customer_name, customer_email, customer_phone, pii_name_ciphertext, pii_email_ciphertext, pii_phone_ciphertext, grand_total, delivered_at, points_awarded')
    .eq('status', 'delivered')
    .or('points_awarded.is.null,points_awarded.eq.false')
    .limit(200)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let credited = 0
  const results: any[] = []

  for (const order of (deliveredOrders || [])) {
    try {
      const phone = revealLegacyPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone)
      let customer: { id: string; name: string | null; email: string | null; phone: string | null; loyalty_points: number | null } | null = null
      if (typeof order.customer_id === 'string' && order.customer_id) {
        const { data } = await supabase.from('customers').select('id, name, email, phone, loyalty_points').eq('id', order.customer_id).maybeSingle()
        customer = data
      }
      // Legacy rows may pre-date a customer_id. Retain a phone-based fallback
      // only for them; new secure orders always use their immutable relation.
      if (!customer && phone) {
        const { data } = await supabase.from('customers').select('id, name, email, phone, loyalty_points').eq('phone', phone).maybeSingle()
        customer = data
      }

      if (!customer) {
        results.push({ ref: order.ref, skipped: 'no linked customer record' })
        continue
      }

      const { data: award, error: awardError } = await supabase.rpc('credit_delivery_loyalty_points', {
        p_order_id: order.id,
        p_customer_id: customer.id,
      })
      if (awardError) throw awardError
      const credit = award as { credited?: boolean; reason?: string; points_earned?: number; balance_after?: number; customer_email?: string; customer_name?: string } | null
      if (!credit?.credited) {
        results.push({ ref: order.ref, skipped: credit?.reason || 'not_eligible' })
        continue
      }

      const pointsEarned = Number(credit.points_earned || 0)
      const newBalance = Number(credit.balance_after || 0)
      const expiresAt = new Date(Date.now() + POINTS_EXPIRY_DAYS * 86400000)

      const toEmail = revealLegacyPii(order.pii_email_ciphertext)
        || revealLegacyPii(order.customer_email)
        || revealLegacyPii(credit.customer_email)
        || revealLegacyPii(customer.email)
      const customerName = revealLegacyPii(order.pii_name_ciphertext)
        || revealLegacyPii(order.customer_name)
        || revealLegacyPii(credit.customer_name)
        || revealLegacyPii(customer.name)
      if (toEmail) {
        const expiryLabel = expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: toEmail,
          subject: `You just earned ${pointsEarned} loyalty points! 🐾`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<div style="background:#1a1008;padding:24px;text-align:center">
  <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
</div>
<div style="background:#f9f6f2;padding:32px;text-align:center">
  <h2 style="color:#1a1008;margin:0 0 8px">Your order was delivered — points are in!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
    Hi ${customerName}, your order <strong>${order.ref}</strong> has been delivered.
    You've earned <strong style="color:#c8973a">${pointsEarned} loyalty points</strong> for this order.
  </p>
  <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Your Points Balance</div>
    <div style="font-size:36px;font-weight:800;color:#c8973a">${newBalance}</div>
  </div>
  <div style="background:#fef3c7;border-radius:12px;padding:16px;margin-bottom:24px">
    <p style="margin:0;font-size:13px;color:#92400e">
      ⏳ These points expire on <strong>${expiryLabel}</strong> — redeem them before then (100 points = ₹30 off).
    </p>
  </div>
  <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">Redeem My Points</a>
</div>
<div style="background:#1a1008;padding:16px;text-align:center">
  <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">Game of Bones · gameofbones.in</p>
</div>
</div>`
        })
      }

      credited++
      results.push({ ref: order.ref, customer: customer.name, pointsEarned, newBalance })
    } catch (e: any) {
      results.push({ ref: order.ref, error: e.message })
    }
  }

  return NextResponse.json({
    ok: true,
    orders_checked: deliveredOrders?.length || 0,
    credited,
    results,
  })
}
