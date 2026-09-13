import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { createDelhiveryShipment } from '@/app/lib/delhivery-shipment'

const DELHIVERY_TOKEN = process.env.DELHIVERY_API_TOKEN
const DELHIVERY_BASE  = 'https://track.delhivery.com'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
      if (typeof orderId !== 'string' || !orderId) return NextResponse.json({ error: 'A valid order is required.' }, { status: 400 })
      // Never accept price, address, or payment details from the browser for a
      // booking. The authenticated admin may request it, but the shipment is
      // always built from the saved server-side order.
      const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
      if (error || !order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
      const result = await createDelhiveryShipment({ order, orderId })
      return NextResponse.json(result, { status: result.ok ? 200 : result.skipped ? 422 : 502 })
    }

    if (action === 'track') {
      const { awb } = orderData
      const res = await fetch(`${DELHIVERY_BASE}/api/v1/packages/json/?waybill=${awb}&verbose=1`, {
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
