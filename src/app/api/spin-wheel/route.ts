import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const prizes = [
  { label: '15% off', detail: 'WELCOME15' }, { label: '₹75 off', detail: 'BONES75' },
  { label: '10% off', detail: 'TAIL10' }, { label: 'Free shipping', detail: 'FREESHIP' },
  { label: '₹50 off', detail: 'PAWS50' }, { label: '20% off', detail: 'MEGA20' },
]
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'spin-wheel', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const name = cleanText(body.name, 100), email = normalizeEmailForHash(cleanText(body.email, 254)), phone = normalizePhoneForHash(cleanText(body.phone, 20))
    if (!name || !emailPattern.test(email) || !/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a name, valid email, and 10-digit mobile number.' }, { status: 400, headers })
    const emailHash = piiHash(email), phoneHash = piiHash(phone)
    const prior = await supabase.from('email_captures').select('prize,coupon_code').eq('source', 'spin_to_win').or(`pii_phone_hash.eq.${phoneHash},pii_email_hash.eq.${emailHash}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (prior.error) throw prior.error
    if (prior.data) return NextResponse.json({ alreadySpun: true, prize: prior.data.prize || 'Your reward', coupon_code: prior.data.coupon_code || '' }, { headers })
    const prize = prizes[randomInt(prizes.length)]
    const insert = await supabase.from('email_captures').insert({ email, name, phone, source: 'spin_to_win', status: 'active', prize: prize.label, coupon_code: prize.detail, pii_email_ciphertext: encryptPii(email), pii_name_ciphertext: encryptPii(name), pii_phone_ciphertext: encryptPii(phone), pii_email_hash: emailHash, pii_phone_hash: phoneHash, pii_key_version: 1 })
    if (insert.error) throw insert.error
    return NextResponse.json({ alreadySpun: false, prize: prize.label, coupon_code: prize.detail }, { status: 201, headers })
  } catch {
    return NextResponse.json({ error: 'Unable to check spin eligibility right now.' }, { status: 500, headers })
  }
}
