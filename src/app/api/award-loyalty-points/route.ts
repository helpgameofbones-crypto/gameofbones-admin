import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'
function decryptData(encrypted: string): string {
  if (!encrypted) return ''
  try {
    const binary = Buffer.from(encrypted, 'base64').toString('binary')
    let result = ''
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return encrypted
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return ''
  if (/^\+?\d{10,13}$/.test(raw)) return raw
  const dec = decryptData(raw)
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw
}

const POINTS_PER_RS10 = 1
const POINTS_EXPIRY_DAYS = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: deliveredOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, ref, customer_name, customer_email, customer_phone, grand_total, delivered_at, points_awarded')
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
      const phone = decryptPhone(order.customer_phone || '')
      if (!phone) {
        results.push({ ref: order.ref, skipped: 'no phone on order' })
        continue
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, email, phone, loyalty_points')
        .eq('phone', phone)
        .maybeSingle()

      if (!customer) {
        results.push({ ref: order.ref, skipped: 'no matching customer row for phone' })
        continue
      }

      const pointsEarned = Math.floor((order.grand_total || 0) / 10) * POINTS_PER_RS10

      if (pointsEarned <= 0) {
        await supabase.from('orders').update({ points_awarded: true }).eq('id', order.id)
        results.push({ ref: order.ref, skipped: 'grand_total too low to earn points' })
        continue
      }

      const newBalance = (customer.loyalty_points || 0) + pointsEarned
      const expiresAt = new Date(Date.now() + POINTS_EXPIRY_DAYS * 86400000)

      await supabase.from('customers').update({
        loyalty_points: newBalance,
        loyalty_points_expire_at: expiresAt.toISOString(),
      }).eq('id', customer.id)

      await supabase.from('orders').update({ points_awarded: true }).eq('id', order.id)

      await supabase.from('activity_log').insert({
        action:      'loyalty points added',
        entity_type: 'customer',
        entity_id:   customer.id,
        entity_name: customer.name,
        details:     `+${pointsEarned} points — auto-credited on delivery of order ${order.ref}`,
      })

      const toEmail = order.customer_email || customer.email
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
    Hi ${order.customer_name || customer.name}, your order <strong>${order.ref}</strong> has been delivered.
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
