import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

const types = new Set(['percent', 'fixed', 'free', 'shipping'])
function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const [coupons, orders] = await Promise.all([
    database().from('coupons').select('*').order('created_at', { ascending: false }).limit(2000),
    database().from('orders').select('coupon_code').not('coupon_code', 'is', null).limit(5000),
  ])
  if (coupons.error || orders.error) return NextResponse.json({ error: 'Unable to load coupons.' }, { status: 500 })
  const usageCounts: Record<string, number> = {}
  for (const order of orders.data || []) if (order.coupon_code) usageCounts[order.coupon_code] = (usageCounts[order.coupon_code] || 0) + 1
  return NextResponse.json({ coupons: coupons.data || [], usageCounts })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 50) : ''
  const type = typeof body?.type === 'string' ? body.type : ''
  const value = Number(body?.value)
  if (!code || !types.has(type) || !Number.isFinite(value) || value < 0 || (type === 'percent' && value > 100)) return NextResponse.json({ error: 'Enter a valid code and discount.' }, { status: 400 })
  const minOrder = Number(body?.min_order || 0), maxUses = Number(body?.max_uses || 0), perCustomer = Number(body?.usagepercustomer || 1)
  if (!Number.isFinite(minOrder) || minOrder < 0 || !Number.isInteger(maxUses) || maxUses < 0 || !Number.isInteger(perCustomer) || perCustomer < 1 || perCustomer > 100) return NextResponse.json({ error: 'Coupon limits are invalid.' }, { status: 400 })
  const validUntil = typeof body?.valid_until === 'string' && body.valid_until && !Number.isNaN(Date.parse(body.valid_until)) ? body.valid_until : null
  const { error } = await database().from('coupons').insert({ code, type, value, min_order: minOrder || null, valid_until: validUntil, usagepercustomer: perCustomer, max_uses: maxUses || null, is_active: body?.is_active !== false })
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'That coupon code already exists.' : 'Unable to create coupon.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; is_active?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'A coupon and status are required.' }, { status: 400 })
  const { error } = await database().from('coupons').update({ is_active: body.is_active }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update coupon.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
