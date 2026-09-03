import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CODE_RE = /^[A-Z0-9-]{2,40}$/

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-coupon-usage', 10, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const code = cleanText(body.code, 40).toUpperCase()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20))
    const email = normalizeEmailForHash(cleanText(body.email, 254))
    if (!CODE_RE.test(code)) return NextResponse.json({ totalUses: 0, customerUses: 0 }, { headers })
    const { data, error } = await supabase.from('orders').select('customer_phone,customer_email,pii_phone_ciphertext,pii_email_ciphertext,pii_phone_hash,pii_email_hash').eq('coupon_code', code).limit(5000)
    if (error) throw error
    const phoneHash = piiHash(phone), emailHash = piiHash(email)
    const customerUses = (data || []).filter(order => {
      const orderPhone = normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone))
      const orderEmail = normalizeEmailForHash(decryptPii(order.pii_email_ciphertext) || revealLegacyPii(order.customer_email))
      return (phone && (order.pii_phone_hash === phoneHash || orderPhone === phone)) || (email && (order.pii_email_hash === emailHash || orderEmail === email))
    }).length
    return NextResponse.json({ totalUses: (data || []).length, customerUses }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to verify coupon usage' }, { status: 500, headers }) }
}
