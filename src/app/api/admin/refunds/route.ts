import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const [orders, refunds, products] = await Promise.all([
    database().from('orders').select('id,grand_total,total_amount,created_at,status,items,payment_method').limit(5000),
    database().from('refunds').select('*').order('created_at', { ascending: false }).limit(5000),
    database().from('products').select('id,name,price').limit(1000),
  ])
  if (orders.error || refunds.error || products.error) return NextResponse.json({ error: 'Unable to load refund data.' }, { status: 500 })
  return NextResponse.json({ orders: orders.data || [], refunds: refunds.data || [], products: products.data || [] })
}
