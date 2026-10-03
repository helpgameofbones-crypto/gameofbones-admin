import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { encryptPii, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'
import { sendDispatchEmail } from '@/app/lib/lifecycle-emails'

const DELHIVERY_BASE = 'https://track.delhivery.com'

type AddressDetails = {
  line1?: unknown
  line2?: unknown
  street?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  pincode?: unknown
}

type ShipmentOrder = Record<string, any>

function text(value: unknown, max = 250): string {
  return typeof value === 'string' ? String(revealLegacyPiiValue(value)).trim().slice(0, max) : ''
}

function quantity(item: any): number {
  return Math.max(1, Number(item?.quantity ?? item?.qty ?? 1) || 1)
}

// pii_address_ciphertext decrypts to a JSON string (checkout stores an
// object), or to the legacy "line, city, state, PIN" text. Parse both; the old
// code treated the decrypted string as "no address" and fell back to {}.
function decryptedAddress(order: ShipmentOrder): AddressDetails | null {
  let decrypted: unknown
  try { decrypted = revealLegacyPiiValue(order.pii_address_ciphertext) } catch { return null }
  if (decrypted && typeof decrypted === 'object') return decrypted as AddressDetails
  if (typeof decrypted !== 'string' || !decrypted.trim()) return null
  try {
    const parsed = JSON.parse(decrypted)
    if (parsed && typeof parsed === 'object') return parsed as AddressDetails
    if (typeof parsed === 'string') decrypted = parsed
  } catch { /* not JSON: legacy comma-separated text */ }
  const structured = addressFromCheckoutAttempt(decrypted)
  return structured || { line1: String(decrypted) }
}

function addressFrom(order: ShipmentOrder, provided?: AddressDetails): { line1: string; line2: string; city: string; state: string; pincode: string } {
  const stored = decryptedAddress(order)
    || (order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : {})
  const source = provided && typeof provided === 'object' ? provided : stored
  return {
    line1: text(source.line1 || source.street || source.address || stored.line1 || stored.street || stored.address),
    line2: text(source.line2 || stored.line2),
    city: text(source.city || stored.city, 80),
    state: text(source.state || stored.state, 80),
    pincode: text(source.pincode || stored.pincode, 6),
  }
}

function addressFromCheckoutAttempt(value: unknown): { street: string; city: string; state: string; pincode: string } | null {
  const parts = text(value, 500).split(',').map(part => part.trim()).filter(Boolean)
  const pincodeIndex = parts.findLastIndex(part => /^\d{6}$/.test(part))
  if (pincodeIndex < 2) return null
  const street = parts.slice(0, pincodeIndex - 2).join(', ')
  const city = parts[pincodeIndex - 2]
  const state = parts[pincodeIndex - 1]
  const pincode = parts[pincodeIndex]
  return street && city && state ? { street, city, state, pincode } : null
}

async function recoverAddressFromCheckoutAttempt(order: ShipmentOrder) {
  if (!order?.id || !order.ref) return order
  const current = addressFrom(order)
  if (current.line1 && current.city && current.state && /^\d{6}$/.test(current.pincode)) return order
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: attempt } = await supabase.from('order_attempts').select('shipping_address').eq('ref', String(order.ref)).limit(1).maybeSingle()
    const address = addressFromCheckoutAttempt(attempt?.shipping_address)
    if (!address) return order
    const { data: repaired, error } = await supabase.from('orders').update({
      pii_address_ciphertext: encryptPii(address),
    }).eq('id', order.id).select('*').maybeSingle()
    if (error) throw error
    return repaired || order
  } catch (error) {
    console.error('[delhivery] checkout-address recovery failed', { orderId: order.id, error })
    return order
  }
}

function safeReveal(value: unknown): string {
  try { return revealLegacyPii(value) } catch { return '' }
}

async function shipmentContact(order: ShipmentOrder): Promise<{ name: string; phone: string }> {
  const cleanPhone = (value: string) => value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
  let name = safeReveal(order.pii_name_ciphertext) || safeReveal(order.customer_name)
  let phone = cleanPhone(safeReveal(order.pii_phone_ciphertext) || safeReveal(order.customer_phone))
  if ((!name || !/^\d{10}$/.test(phone)) && order.customer_id) {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: customer } = await supabase.from('customers').select('name,phone,pii_name_ciphertext,pii_phone_ciphertext').eq('id', String(order.customer_id)).maybeSingle()
      if (customer) {
        name ||= safeReveal(customer.pii_name_ciphertext) || safeReveal(customer.name)
        if (!/^\d{10}$/.test(phone)) phone = cleanPhone(safeReveal(customer.pii_phone_ciphertext) || safeReveal(customer.phone))
      }
    } catch (error) {
      console.error('[delhivery] customer contact lookup failed', { orderId: order.id, error })
    }
  }
  return { name, phone }
}

/**
 * Books one order with Delhivery and persists its AWB. It is deliberately
 * idempotent: retries after a network timeout never create another booking
 * once an AWB has been saved on the order.
 */
export async function createDelhiveryShipment(input: {
  order: ShipmentOrder
  orderId: string
  addressDetails?: AddressDetails
}) {
  const token = process.env.DELHIVERY_API_TOKEN
  const pickupLocation = process.env.DELHIVERY_PICKUP_LOCATION?.trim() || 'game of bones'
  if (!token) return { ok: false as const, skipped: true as const, error: 'DELHIVERY_API_TOKEN is not configured.' }

  let { order } = input
  const { orderId } = input
  if (!orderId || order.delhivery_awb) return { ok: true as const, awb: String(order.delhivery_awb || ''), existing: true as const }

  order = await recoverAddressFromCheckoutAttempt(order)

  const address = addressFrom(order, input.addressDetails)
  // Website checkout and the Razorpay webhook store contact details only in the
  // encrypted pii_* columns; customer_name / customer_phone are legacy fields
  // that new orders never fill. Reading only the legacy fields made every
  // website order look "incomplete", so no AWB was ever requested.
  const { name, phone } = await shipmentContact(order)
  if (!name || !/^\d{10}$/.test(phone) || !address.line1 || !address.city || !address.state || !/^\d{6}$/.test(address.pincode)) {
    const missing = [!name && 'name', !/^\d{10}$/.test(phone) && 'phone', !address.line1 && 'street address', !address.city && 'city', !address.state && 'state', !/^\d{6}$/.test(address.pincode) && 'PIN code'].filter(Boolean).join(', ')
    console.error('[delhivery] shipment skipped: incomplete order', { orderId, ref: order.ref, missing })
    return { ok: false as const, skipped: true as const, error: `Order is missing: ${missing}.` }
  }

  const items = Array.isArray(order.items) ? order.items : []
  if (!items.length) return { ok: false as const, skipped: true as const, error: 'Order has no items to ship.' }

  const totalQty = items.reduce((sum: number, item: any) => sum + quantity(item), 0)
  const totalWeightG = items.reduce((sum: number, item: any) => sum + ((Number(item?.weight_grams) || 100) * quantity(item)), 0)
  const shipment = {
    name,
    add: [address.line1, address.line2].filter(Boolean).join(', '),
    city: address.city,
    state: address.state,
    country: 'India',
    pin: address.pincode,
    phone,
    order: String(order.ref),
    payment_mode: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    cod_amount: order.payment_method === 'cod' ? Number(order.grand_total || 0) : 0,
    total_amount: Number(order.grand_total || 0),
    seller_name: 'Game of Bones',
    seller_add: 'Kalyan, Maharashtra',
    seller_phone: '9082503295',
    seller_gst_tin: '',
    shipping_mode: 'Surface',
    pre_picked_up: '0',
    pickup_location: pickupLocation,
    comment: items.map((item: any) => `${quantity(item)}x ${item.name || item.product_name || 'Treat'}`).join(', '),
    products_desc: items.map((item: any) => item.name || item.product_name || 'Treat').join(', '),
    hsn_code: '',
    cod_info: '',
    weight: Math.max(0.1, totalWeightG / 1000),
    waybill: '',
    quantity: totalQty,
  }
  const formData = new URLSearchParams({ format: 'json', data: JSON.stringify({ shipments: [shipment], pickup_location: { name: pickupLocation } }) })

  let response: Response
  try {
    response = await fetch(`${DELHIVERY_BASE}/api/cmu/create.json`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })
  } catch (error) {
    console.error('[delhivery] shipment network error', { orderId, error })
    return { ok: false as const, error: 'Could not reach Delhivery. The order is saved and can be retried.' }
  }

  const raw = await response.text()
  let result: any = null
  try { result = JSON.parse(raw) } catch { /* handled below */ }
  const awb = result?.packages?.[0]?.waybill
  if (!awb) {
    console.error('[delhivery] shipment rejected', { orderId, status: response.status, response: raw.slice(0, 1500) })
    return { ok: false as const, error: result?.rmk || result?.error || `Delhivery rejected the shipment (HTTP ${response.status}).` }
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error: updateError } = await supabase.from('orders').update({ delhivery_awb: awb, status: 'labelled' }).eq('id', orderId).is('delhivery_awb', null)
  if (updateError) {
    console.error('[delhivery] could not save AWB', { orderId, awb, error: updateError })
    return { ok: false as const, error: 'Delhivery created an AWB, but it could not be saved. Contact support before retrying.' }
  }

  await supabase.from('activity_log').insert({ action: 'AWB generated', entity_type: 'order', entity_id: orderId, details: `AWB: ${awb}` })
  if (!order.dispatch_email_sent_at) {
    try {
      if (await sendDispatchEmail(order, awb)) await supabase.from('orders').update({ dispatch_email_sent_at: new Date().toISOString() }).eq('id', orderId)
    } catch (error) {
      console.error('[delhivery] dispatch email failed', { orderId, error })
    }
  }
  return { ok: true as const, awb: String(awb), existing: false as const }
}
