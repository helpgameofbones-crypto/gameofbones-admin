import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, protectLegacyPii, protectLegacyPiiValue, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'
import { checkoutQuote } from '@/app/lib/checkout-pricing'
import { customerSessionFromRequest } from '@/app/lib/customer-session'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Za-z0-9-]{3,40}$/, PHONE_RE = /^\+?\d{10,13}$/
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = rateLimit(req, 'save-order', 5, 10 * 60 * 1000); if (limitError) return limitError
  const order = await req.json(), phone = revealLegacyPii(order.customer_phone), email = revealLegacyPii(order.customer_email), name = revealLegacyPii(order.customer_name)
  if (!order.ref || !phone) return NextResponse.json({ error:'Missing required fields: ref, customer_phone' }, { status:400, headers })
  if (!REF_RE.test(order.ref) || !PHONE_RE.test(phone) || !['cod','razorpay'].includes(order.payment_method)) return NextResponse.json({ error:'Invalid order details' }, { status:400, headers })
  const session = customerSessionFromRequest(req)
  let canUseWelcome = false
  if (String(order.coupon_code || '').toUpperCase() === 'WELCOME15' && session && normalizePhoneForHash(session.phone) === normalizePhoneForHash(phone)) {
    const history = await supabase.rpc('get_customer_order_history', { p_phone: session.phone })
    canUseWelcome = !history.error && Array.isArray(history.data) && history.data.length === 0
  }
  const quote = await checkoutQuote(supabase, order.items, order.payment_method, order.coupon_code, canUseWelcome)
  const { data: existing } = await supabase.from('orders').select('id').eq('ref',order.ref).limit(1)
  const storedItems = quote.items.map(item => ({ product_name: item.name, pack_label: item.pack_label || null, pack_price: item.price, quantity: item.quantity }))
  const address = revealLegacyPiiValue(order.shipping_address)
  const insertData: Record<string, unknown> = { ref:order.ref, customer_name:protectLegacyPii(name), customer_phone:protectLegacyPii(phone), customer_email:protectLegacyPii(email), pii_name_ciphertext:encryptPii(name), pii_phone_ciphertext:encryptPii(phone), pii_email_hash:piiHash(normalizeEmailForHash(email)), pii_email_ciphertext:encryptPii(email), pii_address_ciphertext:encryptPii(address), pii_phone_hash:piiHash(normalizePhoneForHash(phone)), pii_key_version:1, items:storedItems, subtotal:quote.subtotal, total_amount:quote.subtotal, shipping:0, discount:quote.discount, coupon_code:quote.coupon_code, packaging:quote.packaging, grand_total:quote.grand_total, payment_method:order.payment_method, transaction_id:typeof order.transaction_id === 'string' ? order.transaction_id : null, shipping_address:protectLegacyPiiValue(address), notes:order.notes, referrer_code:typeof order.referrer_code === 'string' ? order.referrer_code : null, referrer_phone:null, referrer_points_credited:false, loyalty_points_redeemed:typeof order.loyalty_points_redeemed === 'number' ? order.loyalty_points_redeemed : 0, payment_status:order.payment_method === 'cod' ? 'pending_cod' : 'pending', status:order.payment_method === 'cod' ? 'confirmed' : 'pending_payment' }
  const updateData = { ...insertData }
  delete updateData.ref
  delete updateData.payment_status
  delete updateData.status
  const { error, data } = existing?.length
    ? await supabase.from('orders').update(updateData).eq('ref', order.ref).select()
    : await supabase.from('orders').insert([insertData]).select()
  if (error) return NextResponse.json({ error:error.message }, { status:400, headers })
  const orderId = data?.[0]?.id
  if (orderId && typeof order.referrer_code === 'string' && order.referrer_code) {
    const { data: referrers } = await supabase.from('customers').select('phone').eq('referral_code', order.referrer_code).limit(1)
    const referrerPhone = normalizePhoneForHash(referrers?.[0]?.phone)
    const referredPhone = normalizePhoneForHash(phone)
    if (referrerPhone && referredPhone && referrerPhone !== referredPhone) {
      const { data: credited } = await supabase.from('referrals').select('id').eq('order_id', orderId).limit(1)
      if (!credited?.length) await supabase.from('referrals').insert({ referrer_phone: referrerPhone, referred_phone: referredPhone, order_id: orderId, points_awarded: 300 })
    }
  }
  return NextResponse.json({ success:true, order:data }, { status:201, headers })
 } catch (e: unknown) { return NextResponse.json({ error:e instanceof Error ? e.message : 'Unable to save order' }, { status:500, headers }) }
}
