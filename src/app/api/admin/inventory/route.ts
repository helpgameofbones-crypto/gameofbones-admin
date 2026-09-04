import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const from = new Date(Date.now() - 30 * 86400000).toISOString()
  const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
    database().from('products').select('*').eq('is_active', true).order('stock', { ascending: true }).limit(1000),
    database().from('orders').select('items').gte('created_at', from).eq('status', 'delivered').limit(5000),
  ])
  if (productsError || ordersError) return NextResponse.json({ error: 'Unable to load inventory.' }, { status: 500 })
  return NextResponse.json({ products: products || [], orders: orders || [] })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; stock?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.stock !== 'number' || !Number.isInteger(body.stock) || body.stock < 0) {
    return NextResponse.json({ error: 'A product and a non-negative whole stock value are required.' }, { status: 400 })
  }
  const { error } = await database().from('products').update({ stock: body.stock }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update stock.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
