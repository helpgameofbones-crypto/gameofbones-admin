import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
import { createDelhiveryShipment } from '@/app/lib/delhivery-shipment'
import { metaSignalsFromNotes, sendMetaPurchase } from '@/app/lib/meta-capi'
import { SPIN_GIFT_MIN_ORDER, claimSpinGift, findSpinGift } from '@/app/lib/spin-gifts'
import { sendOrderPlacedEmail } from '@/app/lib/lifecycle-emails'

export const maxDuration = 20

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! })

type Attempt = { items?: unknown; subtotal?: unknown; shipping_address?: unknown }

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }

function paymentPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
}

// Checkout stores its display address as "line 1, line 2, city, state, PIN".
// Only the final three segments are structurally significant, so commas in a
// building address remain safe.
function structuredAddress(value: unknown) {
  const parts = String(value || '').split(',').map(part => part.trim()).filter(Boolean)
  const pincodeIndex = parts.findLastIndex(part => /^\d{6}$/.test(part))
  if (pincodeIndex < 2) return null
  const street = parts.slice(0, pincodeIndex - 2).join(', ')
  const city = parts[pincodeIndex - 2]
  const state = parts[pincodeIndex - 1]
  const pincode = parts[pincodeIndex]
  return street && city && state ? { street, city, state, pincode } : null
}

function recoveredItemsFromNotes(notes: Record<string, unknown> | undefined) {
  try {
    const source = ['items_1', 'items_2', 'items_3'].map(key => String(notes?.[key] || '')).join('')
    const parsed = source ? JSON.parse(source) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(item => ({
      product_name: item?.name || item?.product_name || item?.n || '',
      pack_label: item?.pack_label || item?.packLabel || item?.size || item?.s || null,
      pack_price: item?.pack_price ?? item?.price ?? item?.p ?? null,
      quantity: item?.quantity || item?.qty || item?.q || 1,
    })).filter(item => Boolean(item.product_name))
  } catch { return [] }
}

function recoveredItemsFromAttempt(items: unknown) {
  if (!Array.isArray(items)) return []
  return items.map((item: any) => ({
    product_name: item?.name || item?.product_name || '',
    pack_label: item?.size || item?.pack_label || null,
    pack_price: item?.unit_price ?? item?.pack_price ?? null,
    quantity: item?.qty || item?.quantity || 1,
  })).filter(item => Boolean(item.product_name))
}

async function checkoutReference(payment: { notes?: Record<string, unknown>; order_id?: string }) {
  const notes = payment.notes || {}
  const direct = typeof notes.order_ref === 'string' ? notes.order_ref : typeof notes.ref === 'string' ? notes.ref : ''
  if (direct) return direct
  if (!payment.order_id) return ''
  try {
    const order = await razorpay.orders.fetch(payment.order_id) as { receipt?: string; notes?: Record<string, unknown> }
    const orderNotes = order.notes || {}
    return typeof orderNotes.order_ref === 'string' ? orderNotes.order_ref : typeof orderNotes.ref === 'string' ? orderNotes.ref : order.receipt || payment.order_id
  } catch (error) {
    console.error('[razorpay-webhook] Could not fetch checkout receipt', error)
    return payment.order_id
  }
}

// Payment notes normally mirror the order's notes; fall back to the order
// itself so the Meta signals captured at checkout are never silently lost.
async function checkoutMetaSignals(payment: { notes?: Record<string, unknown>; order_id?: string }) {
  let notes = payment.notes || {}
  if (!notes.meta_fbp && !notes.meta_ip && !notes.meta_url && payment.order_id) {
    try {
      const order = await razorpay.orders.fetch(payment.order_id) as { notes?: Record<string, unknown> }
      notes = { ...(order.notes || {}), ...notes }
    } catch (error) {
      console.error('[razorpay-webhook] Could not fetch order notes for Meta signals', error)
    }
  }
  return metaSignalsFromNotes(notes)
}

async function matchingAttempt(ref: string): Promise<Attempt | null> {
  for (const delay of [0, 1500, 2500]) {
    if (delay) await sleep(delay)
    const { data } = await supabase.from('order_attempts').select('items, subtotal, shipping_address, coupon_code').eq('ref', ref).limit(1).maybeSingle()
    if (data) return data
  }
  return null
}

async function bookWhenComplete(order: Record<string, any> | null | undefined) {
  if (!order?.id || order.delhivery_awb) return
  try {
    const shipment = await createDelhiveryShipment({ order, orderId: order.id })
    if (!shipment.ok && !shipment.skipped) console.error('[razorpay-webhook] Delhivery booking failed', { orderId: order.id, error: shipment.error })
  } catch (error) {
    console.error('[razorpay-webhook] Delhivery booking threw', { orderId: order.id, error })
  }
}

async function confirmEmailWhenPaid(order: Record<string, any> | null | undefined) {
  if (!order?.id || order.confirmation_email_sent_at) return
  try {
    if (await sendOrderPlacedEmail(order)) {
      await supabase.from('orders').update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', order.id)
    }
  } catch (error) {
    // Payment and fulfilment remain valid if the provider is temporarily down.
    console.error('[razorpay-webhook] confirmation email failed', { orderId: order.id, error })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

    const event = JSON.parse(body)
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const ref = await checkoutReference(payment)
      if (!ref) return NextResponse.json({ received: true })

      let existing: { id: string } | null = null
      for (const delay of [0, 1000, 2000, 3000, 3000]) {
        if (delay) await sleep(delay)
        const { data } = await supabase.from('orders').select('id').eq('ref', ref).limit(1).maybeSingle()
        if (data) { existing = data; break }
      }

      if (existing) {
        const { data: updatedOrder, error } = await supabase.from('orders')
          .update({ payment_status: 'paid', status: 'confirmed', transaction_id: payment.id })
          .eq('id', existing.id).select('*').maybeSingle()
        if (error) throw error
        await confirmEmailWhenPaid(updatedOrder)
        await bookWhenComplete(updatedOrder)
        const meta = await checkoutMetaSignals(payment)
        sendMetaPurchase({ ref, value: Number(updatedOrder?.grand_total || payment.amount || 0) / (updatedOrder?.grand_total ? 1 : 100), items: updatedOrder?.items, email: payment.email, phone: payment.contact, ...meta }).catch(error => console.error('Meta CAPI Purchase event failed', error))
      } else {
        const attempt = await matchingAttempt(ref)
        const notes = payment.notes as Record<string, unknown> | undefined
        let items = recoveredItemsFromNotes(notes)
        let subtotal = Number(payment.amount || 0) / 100
        let source = items.length ? 'razorpay_notes' : ''
        if (!items.length && attempt) {
          items = recoveredItemsFromAttempt(attempt.items)
          subtotal = Number(attempt.subtotal) || subtotal
          source = items.length ? 'order_attempts' : ''
        }
        if (!items.length) {
          const phone = paymentPhone(payment.contact)
          if (phone) {
            const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
            const { data: carts } = await supabase.from('abandoned_carts').select('items,total').eq('customer_phone', phone).gte('abandoned_at', since).order('abandoned_at', { ascending: false }).limit(1)
            if (Array.isArray(carts?.[0]?.items)) { items = carts[0].items; subtotal = Number(carts[0].total) || subtotal; source = 'abandoned_carts' }
          }
        }

        const rawAddress = typeof attempt?.shipping_address === 'string' ? attempt.shipping_address : typeof notes?.address === 'string' ? notes.address : ''
        const address = structuredAddress(rawAddress)
        const addressForStorage = address || (rawAddress ? { street: rawAddress, city: '', state: '', pincode: '' } : null)
        const amount = Number(payment.amount || 0) / 100
        const name = typeof notes?.customer_name === 'string' ? notes.customer_name : ''
        const phone = paymentPhone(payment.contact)
        const recovered = items.length > 0
        const notesText = recovered
          ? `Auto-recovered from Razorpay webhook; checkout details sourced from ${source || 'payment data'}.`
          : 'Auto-recovered from Razorpay webhook; item details were not available. Verify with the customer before shipping.'
        // The customer paid but the browser never saved the order, so apply the
        // spin-wheel free treat here the same way checkout would.
        // Free gifts stack with coupon codes, so apply it whenever eligible.
        if (recovered && subtotal >= SPIN_GIFT_MIN_ORDER) {
          try {
            const eligibleGift = await findSpinGift(supabase, { phoneHash: phone ? piiHash(normalizePhoneForHash(phone)) : null, emailHash: payment.email ? piiHash(normalizeEmailForHash(String(payment.email))) : null })
            if (eligibleGift && await claimSpinGift(supabase, eligibleGift.couponId)) {
              items = [...items, { product_name: eligibleGift.gift.product_name, pack_label: eligibleGift.gift.pack_label, pack_price: 0, quantity: eligibleGift.gift.quantity, is_gift: true, gift_code: eligibleGift.code } as (typeof items)[number]]
            }
          } catch (giftError) {
            console.error('[razorpay-webhook] spin gift lookup failed', giftError)
          }
        }
        const { data: insertedOrder, error } = await supabase.from('orders').insert({
          ref,
          pii_name_ciphertext: name ? encryptPii(name) : null,
          pii_email_ciphertext: payment.email ? encryptPii(String(payment.email)) : null,
          pii_phone_ciphertext: phone ? encryptPii(phone) : null,
          pii_address_ciphertext: addressForStorage ? encryptPii(addressForStorage) : null,
          pii_email_hash: payment.email ? piiHash(normalizeEmailForHash(String(payment.email))) : null,
          pii_phone_hash: phone ? piiHash(normalizePhoneForHash(phone)) : null,
          pii_key_version: 1,
          items,
          subtotal,
          discount: recovered ? Math.max(0, subtotal - amount) : 0,
          shipping: 0,
          packaging: 0,
          grand_total: amount,
          total_amount: amount,
          payment_method: 'razorpay',
          payment_status: 'paid',
          transaction_id: payment.id,
          status: 'confirmed',
          notes: notesText,
          created_at: new Date().toISOString(),
        }).select('*').maybeSingle()
        if (error) throw error
        await confirmEmailWhenPaid(insertedOrder)
        await bookWhenComplete(insertedOrder)
        const meta = await checkoutMetaSignals(payment)
        sendMetaPurchase({ ref, value: amount, items, email: payment.email, phone, ...meta,
          city: meta.city || address?.city || '', state: meta.state || address?.state || '', pincode: meta.pincode || address?.pincode || '' }).catch(error => console.error('Meta CAPI Purchase event failed', error))
      }
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      const ref = typeof payment.notes?.order_ref === 'string' ? payment.notes.order_ref : typeof payment.notes?.ref === 'string' ? payment.notes.ref : ''
      // A stale failed attempt must never overwrite a subsequent capture.
      if (ref) await supabase.from('orders').update({ payment_status: 'failed' }).eq('ref', ref).in('payment_status', ['pending', 'pending_payment'])
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[razorpay-webhook] failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
