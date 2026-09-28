import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { customerOtpHash } from '@/app/lib/customer-session'
import { sendCustomerLoginCode } from '@/app/lib/customer-email'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const phone = cleanText((await request.json()).phone, 20).replace(/\D/g, '').slice(-10)
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid mobile number.' }, { status: 400, headers })
    const ipLimitError = await rateLimit(request, 'customer-otp-request-ip', 5, 15 * 60 * 1000); if (ipLimitError) return ipLimitError
    const phoneLimitError = await rateLimit(request, 'customer-otp-request-phone', 3, 15 * 60 * 1000, phone); if (phoneLimitError) return phoneLimitError
    const { data, error } = await supabase.rpc('get_customer_profile', { p_phone: phone })
    const profile = Array.isArray(data) ? data[0] : null
    const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : ''
    // Return the same response for an unknown account. A phone number is an
    // identifier, not proof of account ownership, so this must not be an
    // account-enumeration oracle.
    if (error || !profile?.exists_flag || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: true }, { status: 202, headers })
    const code = String(randomInt(100000, 1000000))
    // A later code supersedes every earlier code for the same customer. This
    // keeps only the most recently delivered email usable.
    const now = new Date().toISOString()
    const { error: invalidateError } = await supabase.from('customer_email_otps').update({ used_at: now }).eq('phone', phone).is('used_at', null)
    if (invalidateError) throw invalidateError
    const { error: saveError } = await supabase.from('customer_email_otps').insert({ phone, code_hash: customerOtpHash(phone, code), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    if (saveError) throw saveError
    try {
      await sendCustomerLoginCode(email, code)
    } catch (deliveryError) {
      // Do not leave an un-delivered code active when the email provider fails.
      await supabase.from('customer_email_otps').update({ used_at: new Date().toISOString() }).eq('phone', phone).eq('code_hash', customerOtpHash(phone, code)).is('used_at', null)
      throw deliveryError
    }
    return NextResponse.json({ ok: true }, { status: 202, headers })
  } catch (error) {
    console.error('Customer OTP request failed', error)
    return NextResponse.json({ error: 'Unable to send a code right now. Please try again later.' }, { status: 500, headers })
  }
}
