import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30)
  const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 365) : 30
  const from = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await database()
    .from('orders')
    .select('created_at,grand_total,total_amount,payment_method,status,items,shipping_address,coupon_code,discount')
    .gte('created_at', from)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500 })
  return NextResponse.json({ orders: data || [] })
}
