import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCE_RE = /^[a-z_]{2,40}$/
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-email-capture', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const email = cleanText(body.email, 254).toLowerCase(), name = cleanText(body.name, 100), phone = cleanText(body.phone, 20), source = cleanText(body.source, 40)
    if (!EMAIL_RE.test(email) || !SOURCE_RE.test(source) || (phone && !/^\+?\d{10,13}$/.test(phone))) return NextResponse.json({ error: 'Invalid capture details' }, { status: 400, headers })
    const { error } = await supabase.from('email_captures').insert({ email, name: name || null, phone: phone || null, source, status: 'active', prize: cleanText(body.prize, 100) || null, coupon_code: cleanText(body.coupon_code, 80) || null, pii_email_ciphertext: encryptPii(email), pii_name_ciphertext: encryptPii(name), pii_phone_ciphertext: encryptPii(phone), pii_email_hash: piiHash(normalizeEmailForHash(email)), pii_phone_hash: piiHash(normalizePhoneForHash(phone)), pii_key_version: 1 })
    if (error) throw error
    return NextResponse.json({ ok: true }, { status: 201, headers })
  } catch { return NextResponse.json({ error: 'Unable to save your details' }, { status: 500, headers }) }
}
