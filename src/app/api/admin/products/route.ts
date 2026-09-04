import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const cleanText = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const numeric = (value: unknown, min: number, max: number, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback }
const validPath = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9._/-]+$/.test(value) && !value.includes('..')
const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('products').select('*').order('name').limit(2000)
  if (error) return NextResponse.json({ error: 'Unable to load products.' }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) return NextResponse.json({ error: 'A media file is required.' }, { status: 400 })
  const form = await request.formData(); const productId = cleanText(form.get('productId'), 100); const type = form.get('type'); const slot = Math.floor(numeric(form.get('slot'), 0, 5)); const file = form.get('file')
  if (!productId || !(file instanceof File) || (type !== 'image' && type !== 'video')) return NextResponse.json({ error: 'Invalid media upload.' }, { status: 400 })
  const allowed = type === 'image' ? file.type.startsWith('image/') : ['video/mp4', 'video/webm'].includes(file.type)
  const maxBytes = type === 'image' ? 2 * 1024 * 1024 : 4 * 1024 * 1024
  if (!allowed || file.size > maxBytes) return NextResponse.json({ error: type === 'image' ? 'Images must be under 2MB.' : 'MP4 or WebM videos must be under 4MB.' }, { status: 400 })
  const extension = (file.name.split('.').pop() || (type === 'image' ? 'jpg' : 'mp4')).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
  const path = `${productId}/${type}-${slot}-${Date.now()}.${extension}`
  const { error } = await database().storage.from('product-images').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return NextResponse.json({ error: 'Unable to upload media.' }, { status: 500 })
  return NextResponse.json({ url: publicUrl(path), path })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const id = cleanText(body.id, 100); if (!id) return NextResponse.json({ error: 'Product id is required.' }, { status: 400 })
  const db = database()
  if (body.action === 'status') {
    const { error } = await db.from('products').update({ is_active: Boolean(body.is_active) }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Unable to update product status.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (body.action !== 'save') return NextResponse.json({ error: 'Unsupported product update.' }, { status: 400 })
  const rawSizes = Array.isArray(body.sizes) ? body.sizes.slice(0, 20) : []
  const sizes = rawSizes.map((size) => { const item = size as Record<string, unknown>; return { label: cleanText(item.label, 100), price: numeric(item.price, 0, 1_000_000), compare_price: numeric(item.compare_price, 0, 1_000_000), cogs: numeric(item.cogs, 0, 1_000_000), stock: Math.floor(numeric(item.stock, 0, 10_000_000)), weight_grams: numeric(item.weight_grams, 0, 100_000) } }).filter(size => size.label)
  const images = Array.isArray(body.images) ? body.images.filter(url => typeof url === 'string' && url.length <= 2000).slice(0, 6) : []
  const videos = Array.isArray(body.videos) ? body.videos.filter(url => typeof url === 'string' && url.length <= 2000).slice(0, 3) : []
  const first = sizes[0] || { price: 0, compare_price: 0, cogs: 0, weight_grams: 0 }
  const payload = { name: cleanText(body.name, 300), price: first.price, compare_price: first.compare_price, mrp: first.compare_price, cost_price: first.cogs, weight_grams: first.weight_grams, stock: Math.floor(numeric(body.stock, 0, 10_000_000)), reorder_level: Math.floor(numeric(body.reorder_level, 0, 10_000_000, 10)), best_before_days: Math.floor(numeric(body.best_before_days, 0, 36500, 365)), is_active: body.is_active !== false, is_bestseller: Boolean(body.is_bestseller), sizes, images, videos, image_url: typeof images[0] === 'string' ? images[0] : null }
  if (!payload.name) return NextResponse.json({ error: 'Product name is required.' }, { status: 400 })
  const { error } = await db.from('products').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to save product.' }, { status: 500 })
  const replaced = Array.isArray(body.replaced_paths) ? body.replaced_paths.filter(validPath).slice(0, 20) : []
  if (replaced.length) await db.storage.from('product-images').remove(replaced)
  await db.from('activity_log').insert({ action: 'product updated', entity_type: 'product', entity_id: id, entity_name: payload.name })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const paths = Array.isArray(body.paths) ? body.paths.filter(validPath).slice(0, 20) : []
  if (!paths.length) return NextResponse.json({ ok: true })
  const { error } = await database().storage.from('product-images').remove(paths)
  if (error) return NextResponse.json({ error: 'Unable to remove draft media.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
