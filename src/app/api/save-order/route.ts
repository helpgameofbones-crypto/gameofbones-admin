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
  const { data: existingCustomer, error: customerLookupError } = await supabase.from('customers').select('id,name,email,phone,loyalty_points,total_orders,total_spent').eq('phone', phone).maybeSingle()
  if (customerLookupError) throw customerLookupError
  let customerRecord = existingCustomer
  const customerCreated = !customerRecord
  if (!customerRecord) {
    const { data: createdCustomer, error: createCustomerError } = await supabase.from('customers')
      .insert({ name: name || 'Game of Bones customer', phone, email: email || null, total_orders: 0, total_spent: 0, loyalty_points: 0 })
      .select('id,name,email,phone,loyalty_points,total_orders,total_spent').single()
    if (createCustomerError) throw createCustomerError
    customerRecord = createdCustomer
  }
  if (!customerRecord?.id) return NextResponse.json({ error:'Unable to create your customer profile.' }, { status:500, headers })
  if (existingCustomer && (name || email)) {
    const profileUpdate: Record<string, string> = {}
    if (name) profileUpdate.name = name
    if (email) profileUpdate.email = email
    if (Object.keys(profileUpdate).length) await supabase.from('customers').update(profileUpdate).eq('id', customerRecord.id)
  }
  let canUseWelcome = false
  if (String(order.coupon_code || '').toUpperCase() === 'WELCOME15' && session && normalizePhoneForHash(session.phone) === normalizePhoneForHash(phone)) {
    const history = await supabase.rpc('get_customer_order_history', { p_phone: session.phone })
    canUseWelcome = !history.error && Array.isArray(history.data) && history.data.length === 0
  }
  const canRedeemPoints = Boolean(session && normalizePhoneForHash(session.phone) === normalizePhoneForHash(phone))
  const quote = await checkoutQuote(supabase, order.items, order.payment_method, order.coupon_code, canUseWelcome, canRedeemPoints ? Number(customerRecord.loyalty_points || 0) : 0, order.loyalty_points_redeemed)
  const { data: existing } = await supabase.from('orders').select('id').eq('ref',order.ref).limit(1)
  const storedItems = quote.items.map(item => ({ product_name: item.name, pack_label: item.pack_label || null, pack_price: item.price, quantity: item.quantity }))
  const address = revealLegacyPiiValue(order.shipping_address)
  const insertData: Record<string, unknown> = { ref:order.ref, customer_id:customerRecord.id, customer_name:protectLegacyPii(name), customer_phone:protectLegacyPii(phone), customer_email:protectLegacyPii(email), pii_name_ciphertext:encryptPii(name), pii_phone_ciphertext:encryptPii(phone), pii_email_hash:piiHash(normalizeEmailForHash(email)), pii_email_ciphertext:encryptPii(email), pii_address_ciphertext:encryptPii(address), pii_phone_hash:piiHash(normalizePhoneForHash(phone)), pii_key_version:1, items:storedItems, subtotal:quote.subtotal, total_amount:quote.subtotal, shipping:0, discount:quote.discount + quote.points_discount, coupon_code:quote.coupon_code, packaging:quote.packaging, grand_total:quote.grand_total, payment_method:order.payment_method, transaction_id:typeof order.transaction_id === 'string' ? order.transaction_id : null, shipping_address:protectLegacyPiiValue(address), notes:order.notes, referrer_code:typeof order.referrer_code === 'string' ? order.referrer_code : null, referrer_phone:null, referrer_points_credited:false, loyalty_points_redeemed:quote.points_redeemed, payment_status:order.payment_method === 'cod' ? 'pending_cod' : 'pending', status:order.payment_method === 'cod' ? 'confirmed' : 'pending_payment' }
  const updateData = { ...insertData }
  delete updateData.ref
  delete updateData.payment_status
  delete updateData.status
  const { error, data } = existing?.length
    ? await supabase.from('orders').update(updateData).eq('ref', order.ref).select()
    : await supabase.from('orders').insert([insertData]).select()
  if (error) return NextResponse.json({ error:error.message }, { status:400, headers })
  if (!existing?.length) await supabase.from('customers').update({ total_orders: Number(customerRecord.total_orders || 0) + 1, total_spent: Number(customerRecord.total_spent || 0) + quote.grand_total }).eq('id', customerRecord.id)
  // Store the first checkout's delivery and pet details in the account as well.
  // These writes are best-effort: an order must never be lost if optional profile
  // fields are unavailable, and the customer can always edit them in My Account.
  if (customerCreated) {
    const details = order.address_details && typeof order.address_details === 'object' ? order.address_details as Record<string, unknown> : {}
    const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
    const line1 = clean(details.line1, 180), city = clean(details.city, 80), state = clean(details.state, 80), pincode = clean(details.pincode, 6)
    if (line1 && city && state && /^\d{6}$/.test(pincode)) {
      const { error: addressError } = await supabase.rpc('add_customer_address', { p_phone: phone, p_label: 'Home', p_line1: line1, p_line2: clean(details.line2, 180), p_city: city, p_state: state, p_pincode: pincode, p_is_default: true })
      if (addressError) console.error('Customer address profile save failed', addressError)
    }
    const dog = order.dog && typeof order.dog === 'object' ? order.dog as Record<string, unknown> : {}
    const dogName = clean(dog.name, 80), dogBirthday = clean(dog.birthday, 10)
    if (dogName && (!dogBirthday || /^\d{4}-\d{2}-\d{2}$/.test(dogBirthday))) {
      const { error: dogError } = await supabase.rpc('upsert_customer_dog', { p_id: null, p_phone: phone, p_name: dogName, p_breed: '', p_age: '', p_weight: '', p_preferences: '', p_birthday: dogBirthday || null })
      if (dogError) console.error('Customer dog profile save failed', dogError)
    }
  }
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
  return NextResponse.json({ success:true, profile_created: customerCreated, order:data }, { status:201, headers })
 } catch (e: unknown) { return NextResponse.json({ error:e instanceof Error ? e.message : 'Unable to save order' }, { status:500, headers }) }
}
