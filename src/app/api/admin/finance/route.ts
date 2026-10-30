import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { fetchAllRows } from '@/app/lib/fetch-all'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const from = request.nextUrl.searchParams.get('from')
  const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const validFrom = from && !Number.isNaN(Date.parse(from)) ? from : null
  const ordersPage = (start: number, end: number) => {
    let q = database.from('orders').select('*').order('created_at', { ascending: false }).range(start, end)
    if (validFrom) q = q.gte('created_at', validFrom)
    return q
  }
  const [{ data: orders, error: ordersError }, { data: products, error: productsError }] = await Promise.all([
    fetchAllRows(ordersPage),
    database.from('products').select('*').eq('is_active', true).limit(1000),
  ])
  if (ordersError || productsError) return NextResponse.json({ error: 'Unable to load finance data.' }, { status: 500 })

  try {
    return NextResponse.json({ orders: (orders || []).map(revealOrderForAdmin), products: products || [] })
  } catch (error) {
    console.error('Finance data decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
