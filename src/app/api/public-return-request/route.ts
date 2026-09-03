import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizePhoneForHash, piiHash, protectLegacyPii, revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Z0-9-]{3,40}$/
const RETURN_WINDOW_HOURS = 48

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-return-request', 3, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const ref = cleanText(body.ref, 40).toUpperCase()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20))
    const reason = cleanText(body.reason, 120)
    const notes = cleanText(body.notes, 2000)
    if (!REF_RE.test(ref) || !/^\d{10}$/.test(phone) || !reason) return NextResponse.json({ error: 'Invalid return request' }, { status: 400, headers })

    const { data, error } = await supabase.from('orders').select('id,ref,status,delivered_at,customer_name,customer_phone,pii_name_ciphertext,pii_phone_ciphertext,pii_phone_hash').eq('ref', ref).limit(1)
    if (error) throw error
    const order = data?.[0]
    const orderPhone = order ? normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone)) : ''
    const hoursSince = order?.delivered_at ? (Date.now() - new Date(order.delivered_at).getTime()) / 36e5 : Infinity
    if (!order || (order.pii_phone_hash && order.pii_phone_hash !== piiHash(phone)) || orderPhone !== phone || order.status !== 'delivered' || hoursSince > RETURN_WINDOW_HOURS) return NextResponse.json({ error: 'This order is not eligible for a return request' }, { status: 400, headers })

    const { data: existing, error: existingError } = await supabase.from('returns').select('id').eq('order_id', order.id).limit(1)
    if (existingError) throw existingError
    if (existing?.length) return NextResponse.json({ error: 'A return request already exists for this order' }, { status: 409, headers })
    const name = decryptPii(order.pii_name_ciphertext) || revealLegacyPii(order.customer_name)
    const { error: insertError } = await supabase.from('returns').insert({ order_id: order.id, order_ref: order.ref, customer_name: protectLegacyPii(name), customer_phone: protectLegacyPii(phone), reason, notes: notes || null, status: 'requested', source: 'customer' })
    if (insertError) throw insertError
    return NextResponse.json({ success: true }, { status: 201, headers })
  } catch { return NextResponse.json({ error: 'Unable to submit return request' }, { status: 500, headers }) }
}
