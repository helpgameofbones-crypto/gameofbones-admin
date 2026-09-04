import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const view = request.nextUrl.searchParams.get('view')
  const ordersQuery = view === 'shipments'
    ? database().from('orders').select('*').not('delhivery_awb', 'is', null).not('status', 'in', '(delivered,cancelled,returned)').order('created_at', { ascending: false }).limit(1000)
    : database().from('orders').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(2000)
  const [ordersResult, pincodesResult] = await Promise.all([
    ordersQuery,
    view === 'timeline' ? database().from('serviceable_pincodes').select('pincode,zone,city,state').limit(5000) : Promise.resolve({ data: [], error: null }),
  ])
  if (ordersResult.error || pincodesResult.error) return NextResponse.json({ error: 'Unable to load shipping data.' }, { status: 500 })
  try {
    return NextResponse.json({ orders: (ordersResult.data || []).map(revealOrderForAdmin), pincodes: pincodesResult.data || [] })
  } catch {
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; estimated_delivery?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.estimated_delivery !== 'string' || Number.isNaN(Date.parse(body.estimated_delivery))) {
    return NextResponse.json({ error: 'A valid order and delivery date are required.' }, { status: 400 })
  }
  const { error } = await database().from('orders').update({ estimated_delivery: body.estimated_delivery }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update the delivery estimate.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
