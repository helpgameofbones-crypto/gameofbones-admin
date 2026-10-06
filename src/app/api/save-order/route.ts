import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'
import { checkoutQuote } from '@/app/lib/checkout-pricing'
import { customerSessionFromRequest } from '@/app/lib/customer-session'
import { sendOrderPlacedEmail } from '@/app/lib/lifecycle-emails'
import { createDelhiveryShipment } from '@/app/lib/delhivery-shipment'
import { clientIpFromRequest, sendMetaPurchase, type MetaBrowserSignals } from '@/app/lib/meta-capi'
import { SPIN_GIFT_MIN_ORDER, claimSpinGift, findSpinGift, releaseSpinGift } from '@/app/lib/spin-gifts'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Za-z0-9-]{3,40}$/, PHONE_RE = /^\+?\d{10,13}$/
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = await rateLimit(req, 'save-order', 5, 10 * 60 * 1000); if (limitError) return limitError
  const order = await req.json(), phone = revealLegacyPii(order.customer_phone), email = revealLegacyPii(order.customer_email), name = revealLegacyPii(order.customer_name)
  if (!order.ref || !phone) return NextResponse.json({ error:'Missing required fields: ref, customer_phone' }, { status:400, headers })
  if (!REF_RE.test(order.ref) || !PHONE_RE.test(phone) || !['cod','razorpay'].includes(order.payment_method)) return NextResponse.json({ error:'Invalid order details' }, { status:400, headers })
  const session = customerSessionFromRequest(req)
  const customerFields = 'id,name,email,phone,loyalty_points,total_orders,total_spent'
  const phoneHash = piiHash(normalizePhoneForHash(phone))
  const { data: secureCustomer, error: secureLookupError } = phoneHash
    ? await supabase.from('customers').select(customerFields).eq('pii_phone_hash', phoneHash).maybeSingle()
    : { data: null, error: null }
  if (secureLookupError) throw secureLookupError
  const { data: legacyCustomer, error: legacyLookupError } = secureCustomer
    ? { data: null, error: null }
    : await supabase.from('customers').select(customerFields).eq('phone', phone).maybeSingle()
  if (legacyLookupError) throw legacyLookupError
  const existingCustomer = secureCustomer || legacyCustomer
  let customerRecord = existingCustomer
  const customerCreated = !customerRecord
  if (!customerRecord) {
    const { data: createdCustomer, error: createCustomerError } = await supabase.from('customers')
      .insert({ name: name || 'Game of Bones customer', phone, email: email || null, pii_name_ciphertext: encryptPii(name), pii_phone_ciphertext: encryptPii(phone), pii_email_ciphertext: encryptPii(email), pii_phone_hash: phoneHash, pii_email_hash: piiHash(normalizeEmailForHash(email)), pii_key_version: 1, total_orders: 0, total_spent: 0, loyalty_points: 0 })
      .select('id,name,email,phone,loyalty_points,total_orders,total_spent').single()
    if (createCustomerError) throw createCustomerError
    customerRecord = createdCustomer
  }
  if (!customerRecord?.id) return NextResponse.json({ error:'Unable to create your customer profile.' }, { status:500, headers })
  if (existingCustomer && (name || email)) {
    const profileUpdate: Record<string, string | null> = {}
    if (name) { profileUpdate.name = name; profileUpdate.pii_name_ciphertext = encryptPii(name) }
    if (email) { profileUpdate.email = email; profileUpdate.pii_email_ciphertext = encryptPii(email); profileUpdate.pii_email_hash = piiHash(normalizeEmailForHash(email)) }
    if (Object.keys(profileUpdate).length) await supabase.from('customers').update(profileUpdate).eq('id', customerRecord.id)
  }
  let canUseWelcome = false
  if (String(order.coupon_code || '').toUpperCase() === 'WELCOME15' && session && normalizePhoneForHash(session.phone) === normalizePhoneForHash(phone)) {
    const history = await supabase.rpc('get_customer_order_history', { p_phone: session.phone })
    canUseWelcome = !history.error && Array.isArray(history.data) && history.data.length === 0
  }
  const canRedeemPoints = Boolean(session && normalizePhoneForHash(session.phone) === normalizePhoneForHash(phone))
  // COD orders are saved before any payment, so tell the customer instead of silently dropping their points.
  if (order.payment_method === 'cod' && Math.floor(Number(order.loyalty_points_redeemed) || 0) > 0 && !canRedeemPoints) {
    return NextResponse.json({ error: session ? 'Reward points can only be used with the mobile number on your account. Enter that number at checkout, or set reward points to 0.' : 'Please log in again to use your reward points.' }, { status: 400, headers })
  }
  const quote = await checkoutQuote(supabase, order.items, order.payment_method, order.coupon_code, canUseWelcome, canRedeemPoints ? Number(customerRecord.loyalty_points || 0) : 0, order.loyalty_points_redeemed)
  const { data: existingByRef } = await supabase.from('orders').select('id,ref,customer_id,items').eq('ref',order.ref).limit(1)
  const transactionId = typeof order.transaction_id === 'string' ? order.transaction_id.trim() : ''
  // If the webhook got there first under Razorpay's order ID, join that
  // placeholder to the browser's GOB reference instead of inserting a second
  // order for the exact same payment.
  const { data: existingByTransaction } = !existingByRef?.length && transactionId
    ? await supabase.from('orders').select('id,ref,customer_id,items').eq('transaction_id', transactionId).limit(1)
    : { data: [] as Array<{ id: string; ref: string; customer_id: string | null; items: unknown }> }
  const existing = existingByRef?.[0] || existingByTransaction?.[0] || null
  // Coupons such as PAWTY25 are configured as one use per customer in the
  // admin table. Enforce that rule server-side at final checkout, rather than
  // trusting only the browser's coupon preview.
  if (!existing && quote.coupon_code && quote.coupon_uses_per_customer) {
    const { data: priorCouponOrders, error: priorCouponOrdersError } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', customerRecord.id)
      .eq('coupon_code', quote.coupon_code)
      .limit(quote.coupon_uses_per_customer)
    if (priorCouponOrdersError) throw priorCouponOrdersError
    if ((priorCouponOrders || []).length >= quote.coupon_uses_per_customer) {
      return NextResponse.json({ error: 'This offer has already been used on this customer account.' }, { status: 400, headers })
    }
  }
  const webhookPlaceholder = Boolean(existing && !existing.customer_id)
  const storedItems: Array<Record<string, unknown>> = quote.items.map(item => ({ product_name: item.name, pack_label: item.pack_label || null, pack_weight_grams: item.pack_weight_grams, pack_price: item.price, compare_price: item.compare_price || null, is_sale: item.is_sale, quantity: item.quantity }))
  // Bone Run / spin-to-win free gift: added at ₹0 to a new order of ₹499+
  // placed with the same mobile number or email. It is a free item, not a
  // discount, so it stacks with coupon codes and reward points. Claimed
  // atomically so it is used once.
  let claimedGift: { couponId: string; label: string } | null = null
  if ((!existing || webhookPlaceholder) && quote.subtotal >= SPIN_GIFT_MIN_ORDER) {
    try {
      const eligibleGift = await findSpinGift(supabase, { phoneHash, emailHash: piiHash(normalizeEmailForHash(email)) })
      if (eligibleGift && await claimSpinGift(supabase, eligibleGift.couponId)) {
        claimedGift = { couponId: eligibleGift.couponId, label: eligibleGift.gift.label }
        storedItems.push({ product_name: eligibleGift.gift.product_name, pack_label: eligibleGift.gift.pack_label, pack_weight_grams: null, pack_price: 0, compare_price: null, is_sale: false, is_gift: true, gift_code: eligibleGift.code, quantity: eligibleGift.gift.quantity })
      }
    } catch (giftError) {
      // A gift lookup problem must never block a paying customer's order.
      console.error('[save-order] spin gift lookup failed', giftError)
    }
  }
  // If the payment webhook created this order first and already added the gift,
  // carry that line over instead of dropping it when the full order is saved.
  if (!claimedGift && webhookPlaceholder && Array.isArray(existing?.items)) {
    for (const line of existing.items as Array<Record<string, unknown>>) if (line && line.is_gift === true) storedItems.push(line)
  }
  const address = revealLegacyPiiValue(order.shipping_address)
  const addressDetails = order.address_details && typeof order.address_details === 'object' ? order.address_details as Record<string, unknown> : {}
  const structuredAddress = Object.keys(addressDetails).length ? addressDetails : address
  const marketingConsent = order.marketing_consent === true, policyAcknowledged = order.checkout_policy_acknowledged === true
  const insertData: Record<string, unknown> = { ref:order.ref, customer_id:customerRecord.id, pii_name_ciphertext:encryptPii(name), pii_phone_ciphertext:encryptPii(phone), pii_email_hash:piiHash(normalizeEmailForHash(email)), pii_email_ciphertext:encryptPii(email), pii_address_ciphertext:encryptPii(structuredAddress), pii_phone_hash:piiHash(normalizePhoneForHash(phone)), pii_key_version:1, items:storedItems, subtotal:quote.subtotal, total_amount:quote.subtotal, shipping:0, discount:quote.discount + quote.points_discount, coupon_code:quote.coupon_code, packaging:quote.packaging, grand_total:quote.grand_total, payment_method:order.payment_method, transaction_id:typeof order.transaction_id === 'string' ? order.transaction_id : null, notes:order.notes, referrer_code:typeof order.referrer_code === 'string' ? order.referrer_code : null, referrer_phone:null, referrer_points_credited:false, loyalty_points_redeemed:quote.points_redeemed, marketing_consent: marketingConsent, marketing_consent_at: marketingConsent ? new Date().toISOString() : null, privacy_notice_version: typeof order.privacy_notice_version === 'string' ? order.privacy_notice_version.slice(0, 40) : null, checkout_policy_acknowledged_at: policyAcknowledged ? new Date().toISOString() : null, payment_status:order.payment_method === 'cod' ? 'pending_cod' : 'pending', status:order.payment_method === 'cod' ? 'confirmed' : 'pending_payment' }
  const updateData = { ...insertData }
  delete updateData.ref
  delete updateData.payment_status
  delete updateData.status
  // Rename only a webhook-created placeholder to the customer-facing GOB
  // reference. A real existing order keeps its reference and is simply
  // updated idempotently.
  if (webhookPlaceholder) updateData.ref = order.ref
  const { error, data } = existing
    ? await supabase.from('orders').update(updateData).eq('id', existing.id).select()
    : await supabase.from('orders').insert([insertData]).select()
  if (error) { if (claimedGift) await releaseSpinGift(supabase, claimedGift.couponId); console.error('[save-order] persistence failed', error); return NextResponse.json({ error:'Unable to save your order. Please try again.' }, { status:400, headers }) }
  const shouldFinalizeOrder = !existing || webhookPlaceholder
  if (shouldFinalizeOrder) await supabase.from('customers').update({ total_orders: Number(customerRecord.total_orders || 0) + 1, total_spent: Number(customerRecord.total_spent || 0) + quote.grand_total }).eq('id', customerRecord.id)
  // Reserve redeemed points at the same moment the successful order is saved.
  // The old daily repair job left a window where the same balance could be
  // spent twice, or could be deducted after a failed checkout.
  if (shouldFinalizeOrder && data?.[0]?.id && quote.points_redeemed > 0) {
    try {
      const newBalance = Math.max(0, Number(customerRecord.loyalty_points || 0) - quote.points_redeemed)
      const { error: pointsError } = await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customerRecord.id)
      if (pointsError) throw pointsError
      const { error: ledgerError } = await supabase.from('loyalty_ledger').insert({ customer_id: customerRecord.id, customer_name: customerRecord.name || '', customer_phone: customerRecord.phone || phone, type: 'redeemed', points: -quote.points_redeemed, balance_after: newBalance, order_ref: order.ref, description: `Redeemed at checkout on order ${order.ref}` })
      if (ledgerError) throw ledgerError
      await supabase.from('orders').update({ loyalty_points_deducted: true }).eq('id', data[0].id)
    } catch (pointsError) {
      // The saved order remains valid. The protected reconciliation job can
      // safely repair a rare ledger/database failure using the false flag.
      console.error('Checkout loyalty redemption needs reconciliation', pointsError)
    }
  }
  // Private rewards are personal, single-use offers. The price is always
  // quoted server-side above; after the order is safely saved, exhaust the
  // matching private code so it cannot be used on a second order.
  if (shouldFinalizeOrder && quote.single_use_coupon_id) {
    const { error: couponRedeemError } = await supabase.from('coupons')
      .update({ uses_count: 1, is_active: false })
      .eq('id', quote.single_use_coupon_id)
      .eq('uses_count', 0)
      .eq('is_active', true)
    if (couponRedeemError) console.error('Private reward redemption needs reconciliation', couponRedeemError)
  }
  // Store the first checkout's delivery and pet details in the account as well.
  // These writes are best-effort: an order must never be lost if optional profile
  // fields are unavailable, and the customer can always edit them in My Account.
  if (customerCreated) {
    const details = addressDetails
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
  // COD is confirmed at checkout. Razorpay confirmations are intentionally
  // sent from the signed payment webhook, never from the browser request.
  if (shouldFinalizeOrder && data?.[0] && order.payment_method === 'cod') {
    try {
      if (await sendOrderPlacedEmail(data[0])) {
        await supabase.from('orders').update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', data[0].id)
      }
    } catch (emailError) {
      // Checkout already succeeded; do not turn an email-provider hiccup into a failed order.
      console.error('Order confirmation email failed', emailError)
    }
  }
  // COD is a confirmed order at save time. Prepaid purchases are sent only by
  // the signed Razorpay webhook below, never from an unverified browser call.
  if (shouldFinalizeOrder && data?.[0] && order.payment_method === 'cod') {
    const metaBrowser = order.meta && typeof order.meta === 'object' ? order.meta as MetaBrowserSignals : null
    sendMetaPurchase({ ref: order.ref, value: quote.grand_total, items: quote.items, email, phone, name,
      city: typeof addressDetails.city === 'string' ? addressDetails.city : '',
      state: typeof addressDetails.state === 'string' ? addressDetails.state : '',
      pincode: typeof addressDetails.pincode === 'string' ? addressDetails.pincode : '',
      clientIp: clientIpFromRequest(req.headers), userAgent: req.headers.get('user-agent'), browser: metaBrowser }).catch(error => console.error('Meta CAPI COD event failed', error))
  }
  // Book delivery only after the order is safely persisted. A Delhivery
  // problem is recorded server-side but can never turn a paid checkout into a
  // failed order. COD follows the same confirmed-order workflow used by Admin.
  if (shouldFinalizeOrder && data?.[0] && (order.payment_method === 'cod' || transactionId)) {
    try {
      const shipment = await createDelhiveryShipment({ order: data[0], orderId: data[0].id, addressDetails })
      if (!shipment.ok) console.error('[checkout] Delhivery booking deferred', { orderId: data[0].id, error: shipment.error })
    } catch (shipmentError) {
      console.error('[checkout] Delhivery booking failed after order save', shipmentError)
    }
  }
  return NextResponse.json({ success:true, profile_created: customerCreated, order:data, free_gift: claimedGift?.label || null }, { status:201, headers })
 } catch (e: unknown) { console.error('[save-order] unexpected failure', e); return NextResponse.json({ error:'Unable to save your order. Please try again.' }, { status:500, headers }) }
}
