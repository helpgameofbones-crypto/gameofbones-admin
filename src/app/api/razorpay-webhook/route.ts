import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'
import { encryptPii, protectLegacyPii, protectLegacyPiiValue } from '@/app/lib/pii-crypto'
import { createDelhiveryShipment } from '@/app/lib/delhivery-shipment'

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

async function matchingAttempt(ref: string): Promise<Attempt | null> {
  for (const delay of [0, 1500, 2500]) {
    if (delay) await sleep(delay)
    const { data } = await supabase.from('order_attempts').select('items, subtotal, shipping_address').eq('ref', ref).limit(1).maybeSingle()
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
        await bookWhenComplete(updatedOrder)
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
        const { data: insertedOrder, error } = await supabase.from('orders').insert({
          ref,
          customer_name: name ? protectLegacyPii(name) : null,
          customer_email: payment.email ? protectLegacyPii(String(payment.email)) : null,
          customer_phone: phone ? protectLegacyPii(phone) : null,
          shipping_address: addressForStorage ? protectLegacyPiiValue(addressForStorage) : {},
          pii_address_ciphertext: addressForStorage ? encryptPii(addressForStorage) : null,
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
        await bookWhenComplete(insertedOrder)
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
