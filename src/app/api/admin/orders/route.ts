import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

const statusValues = new Set(['placed', 'confirmed', 'dispatched', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'])

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || '200')
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200
  const { data, error } = await database().from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 })

  try {
    return NextResponse.json({ orders: (data || []).map(row => revealOrderForAdmin(row)) })
  } catch (error) {
    console.error('Admin order decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => null) as { ids?: unknown; updates?: Record<string, unknown> } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 200) : []
  const updates = body?.updates || {}
  if (!ids.length) return NextResponse.json({ error: 'Select at least one order.' }, { status: 400 })

  const safeUpdates: Record<string, unknown> = {}
  if (typeof updates.status === 'string' && statusValues.has(updates.status)) safeUpdates.status = updates.status
  if (typeof updates.delivered_at === 'string') safeUpdates.delivered_at = updates.delivered_at
  if (Array.isArray(updates.order_notes)) safeUpdates.order_notes = updates.order_notes.slice(-100)
  if (!Object.keys(safeUpdates).length) return NextResponse.json({ error: 'No permitted order changes were supplied.' }, { status: 400 })

  const { error } = await database().from('orders').update(safeUpdates).in('id', ids)
  if (error) return NextResponse.json({ error: 'Unable to update order.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => null) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 200) : []
  if (!ids.length) return NextResponse.json({ error: 'Select at least one order.' }, { status: 400 })

  const { error } = await database().from('orders').delete().in('id', ids)
  if (error) return NextResponse.json({ error: 'Unable to delete order.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
