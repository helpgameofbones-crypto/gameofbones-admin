import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('orders').select('*').not('delhivery_awb', 'is', null).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load shipments.' }, { status: 500 })
  return NextResponse.json({ orders: (data || []).map(revealOrderForAdmin) })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  if (body.action !== 'sync') return NextResponse.json({ error: 'Unsupported fulfilment action.' }, { status: 400 })
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-delhivery-status`
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` }, cache: 'no-store' })
  const data = await response.json().catch(() => ({ error: 'Sync service returned an invalid response.' }))
  return NextResponse.json(data, { status: response.ok ? 200 : 502 })
}
