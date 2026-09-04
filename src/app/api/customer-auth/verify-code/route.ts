import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { createCustomerSession, customerOtpHash } from '@/app/lib/customer-session'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const limitError = rateLimit(request, 'customer-otp-verify', 5, 15 * 60 * 1000); if (limitError) return limitError
    const body = await request.json()
    const phone = cleanText(body.phone, 20).replace(/\D/g, '').slice(-10)
    const code = cleanText(body.code, 6)
    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400, headers })
    const { data: otp, error } = await supabase.from('customer_email_otps').select('id').eq('phone', phone).eq('code_hash', customerOtpHash(phone, code)).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !otp) return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 401, headers })
    await supabase.from('customer_email_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id)
    return NextResponse.json({ token: createCustomerSession(phone) }, { headers })
  } catch (error) {
    console.error('Customer OTP verification failed', error)
    return NextResponse.json({ error: 'Unable to verify that code right now.' }, { status: 500, headers })
  }
}
