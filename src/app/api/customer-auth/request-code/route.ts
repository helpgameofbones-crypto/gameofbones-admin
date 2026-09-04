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
    const limitError = rateLimit(request, 'customer-otp-request', 3, 15 * 60 * 1000); if (limitError) return limitError
    const phone = cleanText((await request.json()).phone, 20).replace(/\D/g, '').slice(-10)
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid mobile number.' }, { status: 400, headers })
    const { data, error } = await supabase.rpc('get_customer_profile', { p_phone: phone })
    const profile = Array.isArray(data) ? data[0] : null
    const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : ''
    if (error || !profile?.exists_flag || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'We could not find an email address for this account. Please contact support.' }, { status: 404, headers })
    const code = String(randomInt(100000, 1000000))
    const { error: saveError } = await supabase.from('customer_email_otps').insert({ phone, code_hash: customerOtpHash(phone, code), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    if (saveError) throw saveError
    await sendCustomerLoginCode(email, code)
    return NextResponse.json({ ok: true, emailHint: `${email.slice(0, 2)}***@${email.split('@')[1]}` }, { headers })
  } catch (error) {
    console.error('Customer OTP request failed', error)
    return NextResponse.json({ error: 'Unable to send a code right now. Please try again later.' }, { status: 500, headers })
  }
}
