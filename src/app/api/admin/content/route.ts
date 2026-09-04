import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
const plain = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const resource = request.nextUrl.searchParams.get('resource')
  const db = database()
  if (resource === 'banners') {
    const { data, error } = await db.from('banners').select('*').order('position', { ascending: true }).limit(500)
    if (error) return NextResponse.json({ error: 'Unable to load banners.' }, { status: 500 }); return NextResponse.json({ items: data || [] })
  }
  if (resource === 'blogs') {
    const { data, error } = await db.from('blogs').select('*').order('created_at', { ascending: false }).limit(1000)
    if (error) return NextResponse.json({ error: 'Unable to load articles.' }, { status: 500 }); return NextResponse.json({ items: data || [] })
  }
  if (resource === 'dogs') {
    const { data, error } = await db.from('dog_gallery').select('*').order('created_at', { ascending: false }).limit(1000)
    if (error) return NextResponse.json({ error: 'Unable to load dog gallery.' }, { status: 500 }); return NextResponse.json({ items: data || [] })
  }
  if (resource === 'site') {
    const { data, error } = await db.from('site_content').select('*').order('section').limit(500)
    if (error) return NextResponse.json({ error: 'Unable to load site content.' }, { status: 500 }); return NextResponse.json({ items: data || [] })
  }
  return NextResponse.json({ error: 'Unknown content resource.' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.formData(); const resource = String(form.get('resource') || ''); const file = form.get('file')
    if (!(file instanceof File) || !['blogs', 'dogs', 'site'].includes(resource)) return NextResponse.json({ error: 'A valid content file is required.' }, { status: 400 })
    const isVideo = file.type.startsWith('video/')
    if (!file.type.startsWith('image/') && !isVideo) return NextResponse.json({ error: 'Only image or video files are allowed.' }, { status: 400 })
    const maxSize = isVideo ? 4 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) return NextResponse.json({ error: `Files must be under ${isVideo ? '4MB' : '5MB'}.` }, { status: 400 })
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(-120) || 'upload'
    const prefix = resource === 'blogs' ? 'blogs' : resource === 'dogs' ? 'dogs' : 'site'
    const path = `${prefix}/${Date.now()}-${safeName}`
    const { error } = await database().storage.from('product-images').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: 'Unable to upload file.' }, { status: 500 })
    return NextResponse.json({ url: publicUrl(path), media_type: isVideo ? 'video' : 'image' })
  }
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const db = database(); const resource = body.resource
  if (resource === 'banners') {
    const payload = { title: plain(body.title, 300), subtitle: plain(body.subtitle, 500), image_url: plain(body.image_url, 2000), link_page: plain(body.link_page, 100) || 'shop', position: Math.min(Math.max(Math.floor(Number(body.position) || 0), 0), 999), is_active: Boolean(body.is_active) }
    const id = body.id
    const result = typeof id === 'string' ? await db.from('banners').update(payload).eq('id', id) : await db.from('banners').insert(payload)
    if (result.error) return NextResponse.json({ error: 'Unable to save banner.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (resource === 'blogs') {
    const title = plain(body.title, 300), slug = plain(body.slug, 300).replace(/[^a-z0-9-]/g, '')
    if (!title || !slug) return NextResponse.json({ error: 'Article title and URL slug are required.' }, { status: 400 })
    const payload = { title, slug, category: plain(body.category, 100) || 'General', excerpt: plain(body.excerpt, 1000), body: plain(body.body, 50_000), cover_image: plain(body.cover_image, 2000), read_time: Math.min(Math.max(Math.floor(Number(body.read_time) || 3), 1), 120), is_published: Boolean(body.is_published), tags: Array.isArray(body.tags) ? body.tags.filter(x => typeof x === 'string').map(x => x.slice(0, 50)).slice(0, 20) : [] }
    const result = (typeof body.id === 'number' || typeof body.id === 'string') ? await db.from('blogs').update(payload).eq('id', body.id) : await db.from('blogs').insert(payload)
    if (result.error) return NextResponse.json({ error: 'Unable to save article.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (resource === 'dogs') {
    const mediaUrl = plain(body.media_url, 2000); if (!mediaUrl) return NextResponse.json({ error: 'A photo or video is required.' }, { status: 400 })
    const payload = { dog_name: plain(body.dog_name, 200), breed: plain(body.breed, 200), owner_name: plain(body.owner_name, 200), location: plain(body.location, 200), media_url: mediaUrl, media_type: body.media_type === 'video' ? 'video' : 'image', caption: plain(body.caption, 1000), is_featured: Boolean(body.is_featured), is_active: body.is_active !== false }
    const result = (typeof body.id === 'number' || typeof body.id === 'string') ? await db.from('dog_gallery').update(payload).eq('id', body.id) : await db.from('dog_gallery').insert(payload)
    if (result.error) return NextResponse.json({ error: 'Unable to save gallery item.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (resource === 'site') {
    const section = plain(body.section, 100), imageUrl = body.image_url === null ? null : plain(body.image_url, 2000)
    if (!section) return NextResponse.json({ error: 'Content section is required.' }, { status: 400 })
    const existingId = body.id
    const result = (typeof existingId === 'number' || typeof existingId === 'string') ? await db.from('site_content').update({ image_url: imageUrl, is_active: true }).eq('id', existingId) : await db.from('site_content').insert({ section, image_url: imageUrl, title: section, is_active: true })
    if (result.error) return NextResponse.json({ error: 'Unable to save site content.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown content resource.' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>; const db = database()
  if (typeof body.id !== 'string' && typeof body.id !== 'number') return NextResponse.json({ error: 'Content id is required.' }, { status: 400 })
  if (body.resource === 'banners') {
    const { error } = await db.from('banners').update({ is_active: Boolean(body.is_active) }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to update banner.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  if (body.resource === 'blogs') {
    const { error } = await db.from('blogs').update({ is_published: Boolean(body.is_published) }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to update article.' }, { status: 500 }); return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported content update.' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const resource = request.nextUrl.searchParams.get('resource'), id = request.nextUrl.searchParams.get('id') || ''
  if (!id || !['banners', 'blogs', 'dogs'].includes(resource || '')) return NextResponse.json({ error: 'A valid content item is required.' }, { status: 400 })
  const table = resource === 'dogs' ? 'dog_gallery' : resource as 'banners' | 'blogs'
  const { error } = await database().from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete content.' }, { status: 500 }); return NextResponse.json({ ok: true })
}
