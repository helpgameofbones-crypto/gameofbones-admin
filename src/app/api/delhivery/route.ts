import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/app/lib/requireAdmin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELHIVERY_TOKEN = process.env.DELHIVERY_API_TOKEN
const DELHIVERY_BASE  = 'https://track.delhivery.com'

// ===== Same XOR/base64 scheme used by the website's encryptData() =====
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

function itemQty(i: any): number {
  return i?.quantity ?? i?.qty ?? 1
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin(req)
    if (authError) return authError

    if (!DELHIVERY_TOKEN) {
      console.error('[delhivery] DELHIVERY_API_TOKEN is not set')
      return NextResponse.json({ error: 'Server misconfiguration: DELHIVERY_API_TOKEN is not set' }, { status: 500 })
    }

    const { action, orderId, orderData } = await req.json()

    if (action === 'create_shipment') {
      const order = orderData

      const streetRaw = order.shipping_address?.street || order.shipping_address?.line1 || order.shipping_address?.address || ''
      const decryptedStreet = decryptAddressField(streetRaw)
      const decryptedPhone = decryptPhone(order.customer_phone)

      const totalQty = (order.items || []).reduce((s: number, i: any) => s + itemQty(i), 0)
      const totalWeightG = (order.items || []).reduce((s: number, i: any) => s + ((i.weight_grams || 100) * itemQty(i)), 0)

      const payload = {
        shipments: [{
          name:              order.customer_name,
          add:               decryptedStreet,
          city:              order.shipping_address?.city,
          state:             order.shipping_address?.state,
          country:           'India',
          pin:               order.shipping_address?.pincode,
          phone:             decryptedPhone,
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
          pickup_location:   'game of bones',
          comment:           (order.items || []).map((i: any) => `${itemQty(i)}x ${i.name || i.product_name}`).join(', '),
          products_desc:     (order.items || []).map((i: any) => i.name || i.product_name).join(', '),
          hsn_code:          '',
          cod_info:          '',
          weight:            totalWeightG / 1000,
          waybill:           '',
          quantity:          totalQty,
        }],
        pickup_location: {
          name: 'game of bones'
        }
      }

      const formData = new URLSearchParams()
      formData.append('format', 'json')
      formData.append('data', JSON.stringify(payload))

      const res = await fetch(`${DELHIVERY_BASE}/api/cno/create/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      })

      const rawText = await res.text()
      console.log('[delhivery] create_shipment HTTP status:', res.status)
      console.log('[delhivery] create_shipment raw response (first 2000 chars):', rawText.slice(0, 2000))

      let data: any
      try {
        data = JSON.parse(rawText)
      } catch (parseErr) {
        console.error('[delhivery] Delhivery did not return valid JSON:', parseErr)
        return NextResponse.json({
          error: `Delhivery returned a non-JSON response (HTTP ${res.status}). Raw: ${rawText.slice(0, 300)}`
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
        console.error('[delhivery] Delhivery rejected shipment:', JSON.stringify(data))
        return NextResponse.json({ error: data.rmk || data.error || 'Failed to create shipment', raw: data }, { status: 400 })
      }
    }

    if (action === 'track') {
      const { awb } = orderData
      const res = await fetch(`${DELHIVERY_BASE}/api/v1/packages/json/?waybill=${awb}&verbose=true`, {
        headers: { 'Authorization': `Token ${DELHIVERY_TOKEN}` }
      })
      const rawText = await res.text()
      try {
        const data = JSON.parse(rawText)
        return NextResponse.json({ ok: true, tracking: data })
      } catch {
        console.error('[delhivery] track: non-JSON response, status', res.status, rawText.slice(0, 500))
        return NextResponse.json({ error: `Delhivery tracking returned non-JSON (HTTP ${res.status})` }, { status: 502 })
      }
    }

    if (action === 'check_pincode') {
      const { pincode } = orderData
      const res = await fetch(`${DELHIVERY_BASE}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
        headers: { 'Authorization': `Token ${DELHIVERY_TOKEN}` }
      })
      const rawText = await res.text()
      try {
        const data = JSON.parse(rawText)
        const isServiceable = data.delivery_codes?.length > 0
        return NextResponse.json({ ok: true, serviceable: isServiceable, data })
      } catch {
        console.error('[delhivery] check_pincode: non-JSON response, status', res.status, rawText.slice(0, 500))
        return NextResponse.json({ error: `Delhivery pincode check returned non-JSON (HTTP ${res.status})` }, { status: 502 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error: any) {
    console.error('[delhivery] unhandled error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
