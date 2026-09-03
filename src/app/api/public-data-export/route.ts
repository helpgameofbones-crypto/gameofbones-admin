import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-data-export', 2, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20))
    const email = normalizeEmailForHash(cleanText(body.email, 254))
    if (!/^\d{10}$/.test(phone) || !email.includes('@')) return NextResponse.json({ error: 'Valid phone and email are required' }, { status: 400, headers })
    const phoneHash = piiHash(phone), emailHash = piiHash(email)
    const { data, error } = await supabase.from('orders').select('ref,status,created_at,items,subtotal,total_amount,shipping,discount,packaging,grand_total,payment_method,payment_status,transaction_id,notes,customer_name,customer_phone,customer_email,shipping_address,pii_name_ciphertext,pii_phone_ciphertext,pii_email_ciphertext,pii_address_ciphertext,pii_phone_hash,pii_email_hash').limit(5000)
    if (error) throw error
    const orders = (data || []).filter(order => {
      const orderPhone = normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone))
      const orderEmail = normalizeEmailForHash(decryptPii(order.pii_email_ciphertext) || revealLegacyPii(order.customer_email))
      return (order.pii_phone_hash === phoneHash || orderPhone === phone) && (order.pii_email_hash === emailHash || orderEmail === email)
    }).map(order => ({
      ref: order.ref, status: order.status, created_at: order.created_at, items: order.items, subtotal: order.subtotal, total_amount: order.total_amount, shipping: order.shipping, discount: order.discount, packaging: order.packaging, grand_total: order.grand_total, payment_method: order.payment_method, payment_status: order.payment_status, transaction_id: order.transaction_id, notes: order.notes,
      customer_name: decryptPii(order.pii_name_ciphertext) || revealLegacyPii(order.customer_name), customer_phone: decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone), customer_email: decryptPii(order.pii_email_ciphertext) || revealLegacyPii(order.customer_email), shipping_address: decryptPii(order.pii_address_ciphertext) || revealLegacyPiiValue(order.shipping_address),
    }))
    return NextResponse.json({ phone, email, total_orders: orders.length, orders, exported_at: new Date().toISOString() }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to export data' }, { status: 500, headers }) }
}
