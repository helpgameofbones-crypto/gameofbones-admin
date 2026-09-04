import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const [products, bundles] = await Promise.all([
    database().from('products').select('*,product_sizes(*)').eq('is_active', true).order('name').limit(1000),
    database().from('product_bundles').select('*').order('created_at', { ascending: false }).limit(1000),
  ])
  if (products.error || bundles.error) return NextResponse.json({ error: 'Unable to load promotions.' }, { status: 500 })
  return NextResponse.json({ products: products.data || [], bundles: bundles.data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const db = database()
  if (body?.action === 'flash-sale') {
    const productId = typeof body.productId === 'string' ? body.productId : ''
    const salePrice = Number(body.salePrice), start = typeof body.start === 'string' ? Date.parse(body.start) : NaN, end = typeof body.end === 'string' ? Date.parse(body.end) : NaN
    if (!productId || !Number.isFinite(salePrice) || salePrice < 0 || Number.isNaN(start) || Number.isNaN(end) || end <= start) return NextResponse.json({ error: 'Flash sale details are invalid.' }, { status: 400 })
    const { error } = await db.from('products').update({ flash_sale_price: salePrice, flash_sale_start: new Date(start).toISOString(), flash_sale_end: new Date(end).toISOString() }).eq('id', productId)
    if (error) return NextResponse.json({ error: 'Unable to schedule flash sale.' }, { status: 500 })
    await db.from('activity_log').insert({ action: 'flash sale scheduled', entity_type: 'product', entity_id: productId, details: `${salePrice} from ${new Date(start).toISOString()} to ${new Date(end).toISOString()}` })
    return NextResponse.json({ ok: true })
  }
  if (body?.action === 'bundle') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '', description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '', bundlePrice = Number(body.bundle_price)
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : []
    if (!name || !Number.isFinite(bundlePrice) || bundlePrice < 0 || !items.length) return NextResponse.json({ error: 'Bundle name, price, and items are required.' }, { status: 400 })
    const { data: products, error: productError } = await db.from('products').select('name,price').eq('is_active', true).limit(1000)
    if (productError) return NextResponse.json({ error: 'Unable to calculate bundle price.' }, { status: 500 })
    const originalPrice = items.reduce((sum, item) => { const value = item as { name?: unknown; qty?: unknown }; const product = (products || []).find(entry => entry.name === value.name); const qty = Number(value.qty); return sum + Number(product?.price || 0) * (Number.isInteger(qty) && qty > 0 ? Math.min(qty, 100) : 1) }, 0)
    const { error } = await db.from('product_bundles').insert({ name, description, bundle_price: bundlePrice, original_price: originalPrice, discount_percent: originalPrice ? Math.round((1 - bundlePrice / originalPrice) * 100) : 0, items, is_active: true })
    if (error) return NextResponse.json({ error: 'Unable to create bundle.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported promotion action.' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const db = database()
  if (body?.action === 'cancel-flash-sale' && typeof body.productId === 'string') {
    const { error } = await db.from('products').update({ flash_sale_price: null, flash_sale_start: null, flash_sale_end: null }).eq('id', body.productId)
    if (error) return NextResponse.json({ error: 'Unable to cancel flash sale.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (body?.action === 'bundle-status' && typeof body.id === 'string' && typeof body.is_active === 'boolean') {
    const { error } = await db.from('product_bundles').update({ is_active: body.is_active }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to update bundle.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported promotion update.' }, { status: 400 })
}
