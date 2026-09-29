import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { customerOtpHash } from '@/app/lib/customer-session'
import { sendCustomerLoginCode } from '@/app/lib/customer-email'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function customerForEmail(email: string) {
  // A small set of historic customer profiles still holds legacy encrypted
  // values in the original columns. Resolve them server-side during the
  // migration so email login works for every legitimate existing customer.
  const { data, error } = await supabase.from('customers').select('id,email,phone').limit(1000)
  if (error) return { customer: null, error }
  const matches = (data || []).filter(customer => revealLegacyPii(customer.email).toLowerCase() === email)
  return { customer: matches.length === 1 ? matches[0] : null, error: null }
}

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const body = await request.json()
    const email = cleanText(body.email, 254).toLowerCase()
    // Email is the public account identifier. The durable phone relation stays
    // inside the server-side session/RPC layer for compatibility with existing
    // customer data, never in the login form or browser storage.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers })
    const ipLimitError = await rateLimit(request, 'customer-otp-request-ip', 5, 15 * 60 * 1000); if (ipLimitError) return ipLimitError
    const emailLimitError = await rateLimit(request, 'customer-otp-request-email', 3, 15 * 60 * 1000, email); if (emailLimitError) return emailLimitError
    const { customer: profile, error } = await customerForEmail(email)
    const phone = revealLegacyPii(profile?.phone).replace(/\D/g, '').slice(-10)
    // Return the same response for an unknown account. An email address is an
    // identifier, not proof of account ownership, so this must not be an
    // account-enumeration oracle.
    if (error || !profile || !/^\d{10}$/.test(phone)) return NextResponse.json({ ok: true }, { status: 202, headers })
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
