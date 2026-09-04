import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const db = database()
  const [suppliers, packaging, staff] = await Promise.all([
    db.from('suppliers').select('*').eq('is_active', true).order('name').limit(1000),
    db.from('packaging_materials').select('*').order('name').limit(1000),
    db.from('staff_accounts').select('*').order('name').limit(1000),
  ])
  if (suppliers.error || packaging.error || staff.error) return NextResponse.json({ error: 'Unable to load operations data.' }, { status: 500 })
  return NextResponse.json({ suppliers: suppliers.data || [], packaging: packaging.data || [], staff: staff.data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const action = body?.action
  const db = database()
  if (action === 'supplier') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    if (!name) return NextResponse.json({ error: 'Supplier name is required.' }, { status: 400 })
    const text = (key: string, max = 2000) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : ''
    const leadTime = Math.min(Math.max(Number(body.lead_time_days) || 0, 0), 3650)
    const { error } = await db.from('suppliers').insert({ name, contact_name: text('contact_name', 200), phone: text('phone', 50), email: text('email', 320), address: text('address'), products_supplied: text('products_supplied'), lead_time_days: leadTime, moq: text('moq', 500), price_notes: text('price_notes'), is_active: true })
    if (error) return NextResponse.json({ error: 'Unable to add supplier.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'packaging') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    if (!name) return NextResponse.json({ error: 'Material name is required.' }, { status: 400 })
    const text = (key: string, max = 2000) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : ''
    const currentStock = Math.min(Math.max(Math.floor(Number(body.current_stock) || 0), 0), 10_000_000)
    const minStock = Math.min(Math.max(Math.floor(Number(body.min_stock) || 20), 0), 10_000_000)
    const cost = Math.min(Math.max(Number(body.cost_per_unit) || 0, 0), 10_000_000)
    const { error } = await db.from('packaging_materials').insert({ name, unit: text('unit', 100) || 'pieces', current_stock: currentStock, min_stock: minStock, cost_per_unit: cost, supplier: text('supplier', 200), notes: text('notes') })
    if (error) return NextResponse.json({ error: 'Unable to add packaging material.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'staff') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
    const role = ['staff', 'manager', 'readonly'].includes(String(body.role)) ? String(body.role) : 'staff'
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'A valid name and email are required.' }, { status: 400 })
    const { error } = await db.from('staff_accounts').insert({ name, email, role })
    if (error) return NextResponse.json({ error: 'Unable to add staff account.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported operations action.' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const db = database()
  if (body?.action === 'packaging-stock' && typeof body.id === 'string') {
    const stock = Math.floor(Number(body.stock))
    if (!Number.isFinite(stock) || stock < 0 || stock > 10_000_000) return NextResponse.json({ error: 'Stock level is invalid.' }, { status: 400 })
    const { error } = await db.from('packaging_materials').update({ current_stock: stock, updated_at: new Date().toISOString() }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to update stock.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (body?.action === 'supplier-status' && typeof body.id === 'string') {
    const { error } = await db.from('suppliers').update({ is_active: false }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to remove supplier.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported operations update.' }, { status: 400 })
}
