import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// BUGFIX (caught before this cron was ever enabled): orders.customer_phone
// and orders.customer_email are stored XOR+base64 "encrypted" by the
// website's encryptData(), but customers.phone/email elsewhere in this repo
// are always plaintext (e.g. the website's referral lookup matches on the
// last 4 digits of a REAL phone number, and order-reminders emails
// customers.email directly). Upserting raw orders.customer_phone/email here
// would have silently overwritten every customers row with unusable
// ciphertext — breaking referrals and the win-back email cron. Same
// XOR/base64 scheme used throughout this repo (orders page, daily-sales,
// delhivery route) — decrypt here before writing.
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
function decryptEmail(raw: string): string {
  if (!raw) return ''
  if (raw.includes('@')) return raw
  const dec = decryptData(raw)
  return dec.includes('@') ? dec : raw
}

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
    const phone = decryptPhone(o.customer_phone)
    if (!phone) return
    if (!customers[phone]) {
      customers[phone] = {
        phone,
        name: o.customer_name,
        email: decryptEmail(o.customer_email),
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
