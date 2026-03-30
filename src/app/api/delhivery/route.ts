import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELHIVERY_TOKEN = process.env.DELHIVERY_API_TOKEN
const DELHIVERY_BASE  = 'https://track.delhivery.com'

export async function POST(req: NextRequest) {
  try {
    const { action, orderId, orderData } = await req.json()

    if (action === 'create_shipment') {
      const order = orderData

      // Create Delhivery shipment
      const payload = {
        shipments: [{
          name:              order.customer_name,
          add:               order.shipping_address?.line1 + (order.shipping_address?.line2 ? ', ' + order.shipping_address?.line2 : ''),
          city:              order.shipping_address?.city,
          state:             order.shipping_address?.state,
          country:           'India',
          pin:               order.shipping_address?.pincode,
          phone:             order.customer_phone,
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
          comment:           (order.items || []).map((i: any) => `${i.qty}x ${i.name}`).join(', '),
          products_desc:     (order.items || []).map((i: any) => i.name).join(', '),
          hsn_code:          '',
          cod_info:          '',
          weight:            (order.items || []).reduce((s: number, i: any) => s + ((i.weight_grams || 100) * i.qty), 0) / 1000,
          waybill:           '',
          quantity:          (order.items || []).reduce((s: number, i: any) => s + i.qty, 0),
        }],
        pickup_location: {
          name: 'Primary'
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

      const data = await res.json()

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