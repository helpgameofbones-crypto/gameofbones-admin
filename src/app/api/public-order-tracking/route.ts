import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Z0-9-]{3,40}$/

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-order-tracking', 10, 60 * 60 * 1000); if (limitError) return limitError
    const ref = cleanText((await req.json()).ref, 40).toUpperCase()
    if (!REF_RE.test(ref)) return NextResponse.json({ found: false }, { headers })
    // Customers may use the order reference from their confirmation or the AWB
    // from the dispatch message. Neither path exposes customer contact details.
    const { data, error } = await supabase.from('orders').select('ref,status,items,grand_total,total_amount,delhivery_awb').or(`ref.eq.${ref},delhivery_awb.eq.${ref}`).limit(1)
    if (error) throw error
    const order = data?.[0]
    if (!order) return NextResponse.json({ found: false }, { headers })
    const items = Array.isArray(order.items) ? order.items.slice(0, 50).map((item: Record<string, unknown>) => ({ name: String(item.product_name || item.name || 'Item').slice(0, 160), quantity: Number(item.quantity || item.qty || 1) })) : []
    return NextResponse.json({ found: true, ref: order.ref, status: order.status, items, total: Number(order.grand_total || order.total_amount || 0), delhiveryAwb: order.delhivery_awb || null }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to load order' }, { status: 500, headers }) }
}
