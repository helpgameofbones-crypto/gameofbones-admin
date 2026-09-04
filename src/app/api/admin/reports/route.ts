import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const report = request.nextUrl.searchParams.get('report') || 'orders'
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [orders, products, customers] = await Promise.all([
    db.from('orders').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(5000),
    report === 'performance' ? db.from('products').select('name,category,is_active').limit(1000) : Promise.resolve({ data: [], error: null }),
    report === 'cohorts' ? db.from('customers').select('id,phone,created_at').limit(5000) : Promise.resolve({ data: [], error: null }),
  ])
  if (orders.error || products.error || customers.error) return NextResponse.json({ error: 'Unable to load report data.' }, { status: 500 })
  try {
    return NextResponse.json({ orders: (orders.data || []).map(revealOrderForAdmin), products: products.data || [], customers: customers.data || [] })
  } catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
}
