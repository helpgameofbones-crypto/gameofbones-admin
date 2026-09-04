import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const { data, error } = await database().from('orders').select('*').eq('payment_method', 'cod').order('created_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json({ error: 'Unable to load COD orders.' }, { status: 500 })
  try {
    return NextResponse.json({ orders: (data || []).map(revealOrderForAdmin) })
  } catch {
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; confirmed?: unknown; notes?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.confirmed !== 'boolean') {
    return NextResponse.json({ error: 'An order and confirmation state are required.' }, { status: 400 })
  }
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : ''
  const confirmedAt = body.confirmed ? new Date().toISOString() : null
  const { error } = await database().from('orders').update({ cod_confirmed: body.confirmed, cod_confirmed_at: confirmedAt, cod_confirmation_notes: notes }).eq('id', body.id).eq('payment_method', 'cod')
  if (error) return NextResponse.json({ error: 'Unable to update COD confirmation.' }, { status: 500 })
  return NextResponse.json({ ok: true, cod_confirmed_at: confirmedAt })
}
