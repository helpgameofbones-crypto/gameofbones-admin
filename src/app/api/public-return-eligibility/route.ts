import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizePhoneForHash, piiHash, revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Z0-9-]{3,40}$/
const RETURN_WINDOW_HOURS = 48

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-return-eligibility', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const ref = cleanText(body.ref, 40).toUpperCase()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20))
    if (!REF_RE.test(ref) || !/^\d{10}$/.test(phone)) return NextResponse.json({ eligible: false, reason: 'invalid' }, { headers })

    const { data, error } = await supabase.from('orders').select('id,ref,status,delivered_at,customer_phone,pii_phone_ciphertext,pii_phone_hash').eq('ref', ref).limit(1)
    if (error) throw error
    const order = data?.[0]
    const orderPhone = order ? normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone)) : ''
    if (!order || (order.pii_phone_hash && order.pii_phone_hash !== piiHash(phone)) || orderPhone !== phone) return NextResponse.json({ eligible: false, reason: 'not_found' }, { headers })
    if (order.status !== 'delivered' || !order.delivered_at) return NextResponse.json({ eligible: false, reason: 'not_delivered' }, { headers })
    const hoursLeft = Math.max(0, Math.round(RETURN_WINDOW_HOURS - ((Date.now() - new Date(order.delivered_at).getTime()) / 36e5)))
    if (hoursLeft <= 0) return NextResponse.json({ eligible: false, reason: 'expired' }, { headers })
    return NextResponse.json({ eligible: true, ref: order.ref, hoursLeft }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to check return eligibility' }, { status: 500, headers }) }
}
