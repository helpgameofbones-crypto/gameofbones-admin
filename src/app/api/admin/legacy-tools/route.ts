import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const resource = request.nextUrl.searchParams.get('resource'); const db = database()
  if (resource === 'nps') {
    const { data, error } = await db.from('nps_surveys').select('*').order('sent_at', { ascending: false }).limit(5000)
    if (error) return NextResponse.json({ error: 'Unable to load NPS surveys.' }, { status: 500 }); return NextResponse.json({ surveys: data || [] })
  }
  if (resource === 'tasks') {
    const [orders, stock] = await Promise.all([db.from('orders').select('id', { count: 'exact', head: true }).in('status', ['placed', 'confirmed', 'packed', 'labelled']), db.from('products').select('id', { count: 'exact', head: true }).lt('stock', 10).eq('is_active', true)])
    if (orders.error || stock.error) return NextResponse.json({ error: 'Unable to load task counters.' }, { status: 500 })
    return NextResponse.json({ pendingOrders: orders.count || 0, lowStock: stock.count || 0 })
  }
  if (['advanced-analytics', 'duplicates', 'rto'].includes(resource || '')) {
    let query = db.from('orders').select('*').order('created_at', { ascending: resource === 'advanced-analytics' })
    if (resource === 'rto') query = query.not('status', 'in', '("delivered","rto")')
    const { data, error } = await query.limit(5000)
    if (error) return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 })
    try { return NextResponse.json({ orders: (data || []).map(revealOrderForAdmin) }) }
    catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
  }
  return NextResponse.json({ error: 'Unknown admin tool.' }, { status: 400 })
}
