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
