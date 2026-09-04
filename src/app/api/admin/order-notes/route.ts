import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('orders').select('*').order('created_at', { ascending: false }).limit(2000)
  if (error) return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 })
  return NextResponse.json({ orders: (data || []).map(revealOrderForAdmin) })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id : ''; const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  if (!id || !text) return NextResponse.json({ error: 'A valid order and note are required.' }, { status: 400 })
  const db = database(); const { data: order, error: loadError } = await db.from('orders').select('order_notes').eq('id', id).maybeSingle()
  if (loadError || !order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  const notes = Array.isArray(order.order_notes) ? order.order_notes : []
  const updated = [...notes, { text, timestamp: new Date().toISOString(), author: 'Admin' }]
  const { error } = await db.from('orders').update({ order_notes: updated }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to save note.' }, { status: 500 })
  return NextResponse.json({ notes: updated })
}
