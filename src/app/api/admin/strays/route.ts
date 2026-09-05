import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const text = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('strays').select('*').order('created_at').limit(1000)
  if (error) return NextResponse.json({ error: 'Unable to load stray-dog records.' }, { status: 500 })
  return NextResponse.json({ strays: data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.formData(); const file = form.get('file')
    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Use an image under 5MB.' }, { status: 400 })
    const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(-120) || 'image.jpg'; const path = `strays/${Date.now()}-${name}`
    const { error } = await database().storage.from('product-images').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: 'Unable to upload image.' }, { status: 500 })
    return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}` })
  }
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>; const name = text(body.name, 200)
  if (!name) return NextResponse.json({ error: 'Dog name is required.' }, { status: 400 })
  const images = Array.isArray(body.images) ? body.images.filter(image => typeof image === 'string' && image.length <= 2000).slice(0, 12) : []
  const payload = { name, location: text(body.location, 300), description: text(body.description, 4000), images, is_active: body.is_active !== false }
  const result = (typeof body.id === 'string' || typeof body.id === 'number') ? await database().from('strays').update(payload).eq('id', body.id) : await database().from('strays').insert(payload)
  if (result.error) return NextResponse.json({ error: 'Unable to save stray-dog record.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const id = request.nextUrl.searchParams.get('id') || ''; if (!id) return NextResponse.json({ error: 'Record id is required.' }, { status: 400 })
  const { error } = await database().from('strays').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete stray-dog record.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
