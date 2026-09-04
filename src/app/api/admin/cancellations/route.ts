import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await database.from('orders').select('*').eq('status', 'cancelled').order('created_at', { ascending: false }).limit(2000)
  if (error) return NextResponse.json({ error: 'Unable to load cancellations.' }, { status: 500 })
  try { return NextResponse.json({ orders: (data || []).map(revealOrderForAdmin) }) }
  catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
}
