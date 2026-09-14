import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const actions = new Set(['correct', 'delete', 'withdraw_marketing'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const limitError = rateLimit(request, 'public-privacy-request', 3, 24 * 60 * 60 * 1000); if (limitError) return limitError
    const body = await request.json().catch(() => ({}))
    const action = cleanText(body.action, 40), email = cleanText(body.email, 254).toLowerCase()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20)), details = cleanText(body.details, 1000)
    const noticeVersion = cleanText(body.privacy_notice_version, 40) || null
    if (!actions.has(action) || !emailPattern.test(email) || !/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Please provide a valid request, email and 10-digit mobile number.' }, { status: 400, headers })
    const { error } = await supabase.from('privacy_requests').insert({
      action, status: 'received', details: details || null, privacy_notice_version: noticeVersion,
      pii_email_ciphertext: encryptPii(email), pii_phone_ciphertext: encryptPii(phone),
      pii_email_hash: piiHash(normalizeEmailForHash(email)), pii_phone_hash: piiHash(phone), pii_key_version: 1,
    })
    if (error) throw error
    return NextResponse.json({ ok: true }, { status: 201, headers })
  } catch (error) {
    console.error('privacy request submission failed', error)
    return NextResponse.json({ error: 'We could not submit your request. Please contact Customer Care.' }, { status: 500, headers })
  }
}
