import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { createCustomerSession, customerOtpHash } from '@/app/lib/customer-session'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function registrationFields(body: Record<string, unknown>) {
  const email = cleanText(body.email, 254).toLowerCase()
  const phone = normalizePhoneForHash(cleanText(body.phone, 20))
  const code = cleanText(body.code, 6)
  return { email, phone, code }
}

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const body = await request.json() as Record<string, unknown>
    const { email, phone, code } = registrationFields(body)
    if (!EMAIL_RE.test(email) || !/^\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the six-digit code from your email.' }, { status: 400, headers })
    }
    const ipLimitError = await rateLimit(request, 'customer-registration-verify-ip', 10, 15 * 60 * 1000); if (ipLimitError) return ipLimitError
    const emailLimitError = await rateLimit(request, 'customer-registration-verify-email', 5, 15 * 60 * 1000, email); if (emailLimitError) return emailLimitError
    const emailHash = piiHash(normalizeEmailForHash(email))
    const phoneHash = piiHash(phone)
    if (!emailHash || !phoneHash) throw new Error('Unable to verify registration details')
    const { data: otp, error: otpError } = await supabase.from('customer_registration_otps')
      .select('id,name_ciphertext,email_ciphertext,phone_ciphertext')
      .eq('email_hash', emailHash).eq('phone_hash', phoneHash).eq('code_hash', customerOtpHash(phone, code))
      .is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (otpError) throw otpError
    if (!otp) return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 401, headers })
    const { data: consumed, error: consumeError } = await supabase.from('customer_registration_otps')
      .update({ used_at: new Date().toISOString() }).eq('id', otp.id).is('used_at', null).select('id').maybeSingle()
    if (consumeError) throw consumeError
    if (!consumed) return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 401, headers })

    // Recheck after consuming the code so two concurrent registrations cannot
    // create accounts with an already-claimed email or mobile number.
    const { data: available, error: availabilityError } = await supabase.rpc('customer_registration_available', { p_email: email, p_phone: phone })
    if (availabilityError) throw availabilityError
    if (!available) return NextResponse.json({ error: 'An account is already linked to these details. Please sign in instead.' }, { status: 409, headers })

    const name = decryptPii(otp.name_ciphertext)
    const storedEmail = decryptPii(otp.email_ciphertext).toLowerCase()
    const storedPhone = normalizePhoneForHash(decryptPii(otp.phone_ciphertext))
    if (!name || storedEmail !== email || storedPhone !== phone) return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 401, headers })
    const { error: createError } = await supabase.from('customers').insert({
      name,
      email,
      phone,
      pii_name_ciphertext: encryptPii(name),
      pii_email_ciphertext: encryptPii(email),
      pii_phone_ciphertext: encryptPii(phone),
      pii_email_hash: emailHash,
      pii_phone_hash: phoneHash,
      pii_key_version: 1,
      total_orders: 0,
      total_spent: 0,
      loyalty_points: 0,
      acquisition_source: 'account_signup',
    })
    if (createError) {
      if (createError.code === '23505') return NextResponse.json({ error: 'An account is already linked to these details. Please sign in instead.' }, { status: 409, headers })
      throw createError
    }
    return NextResponse.json({ token: createCustomerSession(phone) }, { headers })
  } catch (error) {
    console.error('Customer account-creation OTP verification failed', error)
    return NextResponse.json({ error: 'Unable to create your account right now. Please try again later.' }, { status: 500, headers })
  }
}
