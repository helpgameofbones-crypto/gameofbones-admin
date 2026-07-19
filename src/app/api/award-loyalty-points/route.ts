import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ===== Same XOR/base64 scheme used elsewhere in this codebase =====
// orders.customer_phone is stored encrypted (see website's encryptData()),
// but customers.phone is stored plaintext — so matching an order back to a
// customer row requires decrypting the order's phone first.
// TODO(security): this is a reversible XOR+base64 obfuscation, not real encryption, and the
// key is hardcoded and shipped to client bundles — it provides no real protection. Replace with
// server-side AES-256-GCM (key from a secrets manager, never sent to the browser) and run a
// data migration for existing rows. Not safe to change here without DB access to migrate data.
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
  if (/^\+?\d{10,13}$/.test(raw)) return raw // already plaintext
  const dec = decryptData(raw)
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw
}
function decryptEmail(raw: string | null | undefined): string {
  if (!raw) return ''
  if (raw.includes('@')) return raw // already plaintext
  const dec = decryptData(raw)
  return dec.includes('@') ? dec : ''
}

// Matches the earn rate already advertised on the website's "My Rewards"
// page ("Earn 1 point for every Rs.10 spent") and the redemption rate used
// at checkout (100 points = Rs.30). Points "expire 30 days after earned"
// per the same page's copy.
const POINTS_PER_RS10 = 1
const POINTS_EXPIRY_DAYS = 30

// Cron job (see vercel.json) that runs periodically and finds orders that
// were marked "delivered" — whether by an admin changing the status
// dropdown on /orders, or by the Delhivery status-sync function — but
// haven't had loyalty points credited yet. Credits points to the matching
// customer row and emails them their new balance + expiry date.
//
// NOTE: this app doesn't have a real per-batch points ledger (points earned
// at different times don't expire independently) — loyalty_points is a
// single running balance, same as the existing manual "Add Points" flow on
// /loyalty. Each time new points are credited here, the customer's single
// loyalty_points_expire_at is pushed out 30 days. That's a simplification:
// it means points effectively keep resetting to a fresh 30-day clock as
// long as a customer keeps ordering, but it can't precisely expire an
// older batch while a newer batch is still valid. Doing that properly
// needs a real ledger table (loyalty_transactions: customer_id, points,
// earned_at, expires_at) — flagging this as a Follow-up rather than solving
// it here, since it needs a schema decision, not just a bug fix.
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

      let customer: { id: string; name: string; email: string | null; phone: string; loyalty_points: number | null } | null = null
      {
        const { data } = await supabase
          .from('customers')
          .select('id, name, email, phone, loyalty_points')
          .eq('phone', phone)
          .maybeSingle()
        customer = data
      }

      // Phone formats can differ between what a customer typed at checkout
      // (which is what `phone` is, after decrypting) and what's stored on the
      // customers row (with/without +91, spaces, dashes) — retry on the last
      // 10 digits before giving up. This was previously an exact-match-only
      // lookup, which is why orders with a differently-formatted phone never
      // matched and silently never credited points.
      if (!customer) {
        const last10 = phone.replace(/\D/g, '').slice(-10)
        if (last10.length === 10) {
          const { data } = await supabase
            .from('customers')
            .select('id, name, email, phone, loyalty_points')
            .ilike('phone', `%${last10}`)
            .maybeSingle()
          customer = data
        }
      }

      // Still no customer row at all — rather than skipping forever (which is
      // exactly why some delivered orders never credited points, e.g. when a
      // customer's very first order is the one being delivered and no /customers
      // row was ever created for them), create one now from the order's own
      // details so points can be credited on this run instead of never.
      if (!customer) {
        const { data: created, error: createError } = await supabase
          .from('customers')
          .insert({
            name: order.customer_name || 'Customer',
            email: decryptEmail(order.customer_email) || null,
            phone,
            loyalty_points: 0,
          })
          .select('id, name, email, phone, loyalty_points')
          .maybeSingle()

        if (createError || !created) {
          results.push({ ref: order.ref, skipped: `no matching customer row and auto-create failed: ${createError?.message || 'unknown error'}` })
          continue
        }
        customer = created
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

      // Crediting is done and committed at this point — everything below is
      // best-effort notification only. A failed email must NOT be reported as
      // an error for this order (that's exactly what happened before: the
      // credit succeeded but an email exception made the whole order look
      // like it failed, which was misleading).
      credited++
      const orderResult: any = { ref: order.ref, customer: customer.name, pointsEarned, newBalance }
      results.push(orderResult)

      const toEmail = decryptEmail(order.customer_email) || customer.email || ''
      if (toEmail) {
        try {
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
        } catch (emailError: any) {
          orderResult.emailError = `points credited fine, but the notification email failed: ${emailError.message}`
        }
      } else {
        orderResult.emailError = 'points credited fine, but no usable email address was found to notify the customer'
      }
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