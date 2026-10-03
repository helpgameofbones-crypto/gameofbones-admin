import { randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
import { sendWheelWelcomeEmail } from '@/app/lib/lifecycle-emails'
import { SPIN_GIFT_MIN_ORDER, SPIN_GIFT_VALID_DAYS, spinGifts } from '@/app/lib/spin-gifts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const spinCouponCode = () => `SPIN${randomBytes(5).toString('hex').toUpperCase()}`

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = await rateLimit(req, 'spin-wheel', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const name = cleanText(body.name, 100), email = normalizeEmailForHash(cleanText(body.email, 254)), phone = normalizePhoneForHash(cleanText(body.phone, 20))
    if (!name || !emailPattern.test(email) || !/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a name, valid email, and 10-digit mobile number.' }, { status: 400, headers })
    if (body.marketing_consent !== true) return NextResponse.json({ error: 'Please agree to receive your offer by email.' }, { status: 400, headers })
    const emailHash = piiHash(email), phoneHash = piiHash(phone)
    const prior = await supabase.from('email_captures').select('prize,coupon_code').eq('source', 'spin_to_win').or(`pii_phone_hash.eq.${phoneHash},pii_email_hash.eq.${emailHash}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (prior.error) throw prior.error
    if (prior.data?.coupon_code && /^SPIN[A-Z0-9]+$/.test(prior.data.coupon_code)) return NextResponse.json({ alreadySpun: true, prize: prior.data.prize || 'Your reward', coupon_code: prior.data.coupon_code }, { headers })
    const prize = spinGifts[randomInt(spinGifts.length)]
    const couponCode = spinCouponCode(), today = new Date().toISOString().slice(0, 10)
    const expires = new Date(Date.now() + SPIN_GIFT_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const couponInsert = await supabase.from('coupons').insert({ code: couponCode, type: 'free', value: 0, min_order: SPIN_GIFT_MIN_ORDER, max_uses: 1, uses_count: 0, valid_from: today, valid_until: expires, is_active: true })
    if (couponInsert.error) throw couponInsert.error
    const insert = await supabase.from('email_captures').insert({ source: 'spin_to_win', status: 'active', prize: prize.label, coupon_code: couponCode, marketing_consent: true, marketing_consent_at: new Date().toISOString(), pii_email_ciphertext: encryptPii(email), pii_name_ciphertext: encryptPii(name), pii_phone_ciphertext: encryptPii(phone), pii_email_hash: emailHash, pii_phone_hash: phoneHash, pii_key_version: 1 }).select('id').single()
    if (insert.error) throw insert.error
    try {
      await sendWheelWelcomeEmail({ name, email, couponCode, prize: prize.label, gift: true })
      await supabase.from('email_captures').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', insert.data.id)
    } catch (emailError) {
      // A prize must never be lost because the mail provider is temporarily unavailable.
      // The missing timestamp keeps the capture identifiable for a safe resend from admin.
      console.error('Spin-wheel welcome email failed', emailError)
    }
    return NextResponse.json({ alreadySpun: false, prize: prize.label, coupon_code: couponCode, gift: true, min_order: SPIN_GIFT_MIN_ORDER, valid_days: SPIN_GIFT_VALID_DAYS }, { status: 201, headers })
  } catch {
    return NextResponse.json({ error: 'Unable to check spin eligibility right now.' }, { status: 500, headers })
  }
}
