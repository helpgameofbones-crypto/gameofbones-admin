import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const from = new Date(Date.now() - 30 * 86400000).toISOString()
  const [customers, products, orders] = await Promise.all([
    db.from('customers').select('name,email,phone,total_orders,total_spent').not('email', 'is', null).limit(5000),
    db.from('products').select('*').eq('is_active', true).limit(1000),
    db.from('orders').select('items,created_at').gte('created_at', from).limit(5000),
  ])
  if (customers.error || products.error || orders.error) return NextResponse.json({ error: 'Unable to load campaign data.' }, { status: 500 })
  return NextResponse.json({ customers: customers.data || [], products: products.data || [], orders: orders.data || [] })
}
