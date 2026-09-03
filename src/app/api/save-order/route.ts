import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, protectLegacyPii, protectLegacyPiiValue, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Za-z0-9-]{3,40}$/, PHONE_RE = /^\+?\d{10,13}$/
function validItems(items: unknown): items is Array<{name:string;price:number;quantity:number}> { return Array.isArray(items) && items.length > 0 && items.length <= 50 && items.every(item => item && typeof item.name === 'string' && typeof item.price === 'number' && Number.isFinite(item.price) && typeof item.quantity === 'number' && Number.isFinite(item.quantity)) }
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = rateLimit(req, 'save-order', 5, 10 * 60 * 1000); if (limitError) return limitError
  const order = await req.json(), phone = revealLegacyPii(order.customer_phone), email = revealLegacyPii(order.customer_email), name = revealLegacyPii(order.customer_name)
  if (!order.ref || !phone) return NextResponse.json({ error:'Missing required fields: ref, customer_phone' }, { status:400, headers })
  if (!REF_RE.test(order.ref) || !PHONE_RE.test(phone) || !validItems(order.items) || ![order.total_amount,order.shipping,order.discount,order.grand_total].every((value:unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0) || order.grand_total < 1 || order.grand_total > 100000 || !['cod','razorpay'].includes(order.payment_method)) return NextResponse.json({ error:'Invalid order details' }, { status:400, headers })
  const { data: existing } = await supabase.from('orders').select('id').eq('ref',order.ref).limit(1)
  const storedItems = order.items.map((item: any) => ({ product_name: item.name, pack_label: item.pack_label ?? null, pack_price: item.price, quantity: item.quantity, bundle_id: item.bundle_id, bundle_name: item.bundle_name }))
  const address = revealLegacyPiiValue(order.shipping_address)
  const insertData: Record<string, unknown> = { ref:order.ref, customer_name:protectLegacyPii(name), customer_phone:protectLegacyPii(phone), customer_email:protectLegacyPii(email), pii_name_ciphertext:encryptPii(name), pii_phone_ciphertext:encryptPii(phone), pii_email_ciphertext:encryptPii(email), pii_address_ciphertext:encryptPii(address), pii_phone_hash:piiHash(normalizePhoneForHash(phone)), pii_email_hash:piiHash(normalizeEmailForHash(email)), pii_key_version:1, items:storedItems, subtotal:typeof order.subtotal === 'number' ? order.subtotal : order.total_amount, total_amount:order.total_amount, shipping:order.shipping, discount:order.discount, coupon_code:typeof order.coupon_code === 'string' ? order.coupon_code : null, packaging:typeof order.packaging === 'number' ? order.packaging : 0, grand_total:order.grand_total, payment_method:order.payment_method, transaction_id:typeof order.transaction_id === 'string' ? order.transaction_id : null, shipping_address:protectLegacyPiiValue(address), notes:order.notes, referrer_code:typeof order.referrer_code === 'string' ? order.referrer_code : null, referrer_phone:null, referrer_points_credited:false, loyalty_points_redeemed:typeof order.loyalty_points_redeemed === 'number' ? order.loyalty_points_redeemed : 0, payment_status:order.payment_method === 'cod' ? 'pending_cod' : 'pending', status:order.payment_method === 'cod' ? 'confirmed' : 'pending_payment' }
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
  fetch('https://gameofbones-admin.vercel.app/api/order-confirmation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})}).catch(() => undefined)
  return NextResponse.json({ success:true, order:data }, { status:201, headers })
 } catch (e: unknown) { return NextResponse.json({ error:e instanceof Error ? e.message : 'Unable to save order' }, { status:500, headers }) }
}
