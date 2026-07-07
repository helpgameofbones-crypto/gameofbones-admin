import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELHIVERY_TOKEN = process.env.DELHIVERY_API_TOKEN
const DELHIVERY_BASE  = 'https://track.delhivery.com'

// Same XOR+base64 scheme the website uses to encrypt customer_phone /
// shipping_address.street at checkout (see src/app/orders/page.tsx for the
// admin-side decrypt this mirrors). Orders fetched with the anon key still
// have these fields encrypted, so we have to reverse it here before sending
// anything to Delhivery -- otherwise the label gets scrambled data.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'
function decryptData(encrypted: string): string {
  if (!encrypted) return ''
  try {
    const binary = Buffer.from(encrypted, 'base64').toString('binary')
    let result = ''
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return encrypted
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return ''
  if (/^\+?\d{10,13}$/.test(raw)) return raw
  const dec = decryptData(raw)
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw
}
function decryptAddressField(raw: string): string {
  if (!raw) return ''
  const dec = decryptData(raw)
  const printable = dec.replace(/[\x20-\x7E]/g, '').length
  return printable / Math.max(dec.length, 1) > 0.3 ? raw : dec
}
// Order items have shown up under both naming conventions across this
// codebase (`qty`/`name` in some places, `quantity`/`product_name` in
// others) -- read whichever is present instead of assuming one.
function itemQty(i: any): number { return Number(i.qty ?? i.quantity ?? 1) }
function itemName(i: any): string { return i.name ?? i.product_name ?? 'Item' }

export async function POST(req: NextRequest) {
  try {
    const { action, orderId, orderData } = await req.json()

    if (action === 'create_shipment') {
      const order = orderData
      const streetRaw = order.shipping_address?.street || order.shipping_address?.line1 || order.shipping_address?.address
      const street = decryptAddressField(streetRaw)
      const phone = decryptPhone(order.customer_phone)
      const items = order.items || []

      // Create Delhivery shipment
      const payload = {
        shipments: [{
          name:              order.customer_name,
          add:               street + (order.shipping_address?.line2 ? ', ' + order.shipping_address?.line2 : ''),
          city:              order.shipping_address?.city,
          state:             order.shipping_address?.state,
          country:           'India',
          pin:               order.shipping_address?.pincode,
          phone:             phone,
          order:             order.ref,
          payment_mode:      order.payment_method === 'cod' ? 'COD' : 'Prepaid',
          cod_amount:        order.payment_method === 'cod' ? order.grand_total : 0,
          total_amount:      order.grand_total,
          seller_name:       'Game of Bones',
          seller_add:        'Kalyan, Maharashtra',
          seller_phone:      '9082503295',
          seller_gst_tin:    '',
          shipping_mode:     'Surface',
          pre_picked_up:     '0',
          pickup_location:   'Primary',
          comment:           items.map((i: any) => `${itemQty(i)}x ${itemName(i)}`).join(', '),
          products_desc:     items.map((i: any) => itemName(i)).join(', '),
          hsn_code:          '',
          cod_info:          '',
          weight:            items.reduce((s: number, i: any) => s + ((i.weight_grams || 100) * itemQty(i)), 0) / 1000,
          waybill:           '',
          quantity:          items.reduce((s: number, i: any) => s + itemQty(i), 0),
        }],
        pickup_location: {
          name: 'Primary'
        }
      }

      const formData = new URLSearchParams()
      formData.append('format', 'json')
      formData.append('data', JSON.stringify(payload))

      const res = await fetch(`${DELHIVERY_BASE}/api/cmu/create.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      })

      const rawText = await res.text()
      let data: any
      try {
        data = JSON.parse(rawText)
      } catch {
        // Delhivery returned HTML instead of JSON -- almost always an invalid/
        // missing DELHIVERY_API_TOKEN, or the "Primary" pickup_location name
        // below doesn't match a pickup location configured in your Delhivery
        // ONE account (Settings -> Pickup Locations).
        return NextResponse.json({
          error: `Delhivery returned a non-JSON response (HTTP ${res.status}). This usually means DELHIVERY_API_TOKEN is missing/invalid, or no pickup location named "Primary" exists in your Delhivery ONE account.`,
          raw: rawText.slice(0, 500),
        }, { status: 502 })
      }

      if (data.packages && data.packages[0]?.waybill) {
        const awb = data.packages[0].waybill

        await supabase.from('orders')
          .update({ delhivery_awb: awb, status: 'labelled' })
          .eq('id', orderId)

        await supabase.from('activity_log').insert({
          action:      'AWB generated',
          entity_type: 'order',
          entity_id:   orderId,
          details:     'AWB: ' + awb,
        })

        return NextResponse.json({ ok: true, awb })
      } else {
        return NextResponse.json({ error: data.rmk || 'Failed to create shipment', raw: data }, { status: 400 })
      }
    }

    if (action === 'track') {
      const { awb } = orderData
      const res = await fetch(`${DELHIVERY_BASE}/api/v1/packages/json/?waybill=${awb}&verbose=true`, {
        headers: { 'Authorization': `Token ${DELHIVERY_TOKEN}` }
      })
      const data = await res.json()
      return NextResponse.json({ ok: true, tracking: data })
    }

    if (action === 'check_pincode') {
      const { pincode } = orderData
      const res = await fetch(`${DELHIVERY_BASE}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
        headers: { 'Authorization': `Token ${DELHIVERY_TOKEN}` }
      })
      const data = await res.json()
      const isServiceable = data.delivery_codes?.length > 0
      return NextResponse.json({ ok: true, serviceable: isServiceable, data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
