import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { customerOtpHash } from '@/app/lib/customer-session'
import { sendCustomerAccountCreationCode } from '@/app/lib/customer-email'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function registrationFields(body: Record<string, unknown>) {
  const name = cleanText(body.name, 100).replace(/\s+/g, ' ')
  const email = cleanText(body.email, 254).toLowerCase()
  const phone = normalizePhoneForHash(cleanText(body.phone, 20))
  return { name, email, phone }
}

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const body = await request.json() as Record<string, unknown>
    const { name, email, phone } = registrationFields(body)
    if (name.length < 2 || !EMAIL_RE.test(email) || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter your name, a valid email address, and a 10-digit mobile number.' }, { status: 400, headers })
    }
    const ipLimitError = await rateLimit(request, 'customer-registration-request-ip', 5, 15 * 60 * 1000); if (ipLimitError) return ipLimitError
    const emailLimitError = await rateLimit(request, 'customer-registration-request-email', 3, 15 * 60 * 1000, email); if (emailLimitError) return emailLimitError
    const phoneLimitError = await rateLimit(request, 'customer-registration-request-phone', 3, 15 * 60 * 1000, phone); if (phoneLimitError) return phoneLimitError

    const { data: available, error: availabilityError } = await supabase.rpc('customer_registration_available', { p_email: email, p_phone: phone })
    if (availabilityError) throw availabilityError
    // A registration cannot replace or merge an existing account. Tell a
    // customer how to proceed rather than showing a verification step for
    // which no code can be sent. Endpoint-level rate limits still limit
    // account-discovery abuse.
    if (!available) return NextResponse.json({ error: 'An account is already linked to these details. Please sign in instead.' }, { status: 409, headers })

    const emailHash = piiHash(normalizeEmailForHash(email))
    const phoneHash = piiHash(phone)
    if (!emailHash || !phoneHash) throw new Error('Unable to protect registration details')
    const code = String(randomInt(100000, 1000000))
    const now = new Date().toISOString()
    const { error: invalidateError } = await supabase.from('customer_registration_otps')
      .update({ used_at: now })
      .or(`email_hash.eq.${emailHash},phone_hash.eq.${phoneHash}`)
      .is('used_at', null)
    if (invalidateError) throw invalidateError
    const { error: saveError } = await supabase.from('customer_registration_otps').insert({
      name_ciphertext: encryptPii(name),
      email_ciphertext: encryptPii(email),
      phone_ciphertext: encryptPii(phone),
      email_hash: emailHash,
      phone_hash: phoneHash,
      code_hash: customerOtpHash(phone, code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      pii_key_version: 1,
    })
    if (saveError) throw saveError
    try {
      await sendCustomerAccountCreationCode(email, code)
    } catch (deliveryError) {
      await supabase.from('customer_registration_otps').update({ used_at: new Date().toISOString() })
        .eq('email_hash', emailHash).eq('phone_hash', phoneHash).eq('code_hash', customerOtpHash(phone, code)).is('used_at', null)
      throw deliveryError
    }
    return NextResponse.json({ ok: true }, { status: 202, headers })
  } catch (error) {
    console.error('Customer account-creation OTP request failed', error)
    return NextResponse.json({ error: 'Unable to send a code right now. Please try again later.' }, { status: 500, headers })
  }
}
