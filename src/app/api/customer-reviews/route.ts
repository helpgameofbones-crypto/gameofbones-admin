import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { customerSessionFromRequest } from '@/app/lib/customer-session'
import { cleanText, rejectUnexpectedOrigin, rateLimit } from '@/app/lib/public-request'
import { normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const PHOTO_BUCKET = 'review-photos'
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type OrderItem = { product_name?: unknown; name?: unknown }
type Order = { id: string; ref: string; items: unknown; delivered_at: string | null; updated_at: string | null }
type Product = { id: string; name: string; image_url?: string | null; images?: string[] | null }

function unauthorized(request: NextRequest) { return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers: corsHeaders(request) }) }
function normalizeName(value: string) { return value.trim().toLocaleLowerCase('en-IN').replace(/\s+/g, ' ') }
function itemNames(items: unknown) {
  return Array.isArray(items) ? [...new Set((items as OrderItem[]).map(item => cleanText(item.product_name ?? item.name, 140)).filter(Boolean))] : []
}
function publicImage(product: Product) { return cleanText(product.image_url, 1000) || (Array.isArray(product.images) ? cleanText(product.images[0], 1000) : '') }

async function customerForPhone(phone: string) {
  const hash = piiHash(normalizePhoneForHash(phone))
  const secure = hash ? await db.from('customers').select('id,name,phone').eq('pii_phone_hash', hash).maybeSingle() : { data: null, error: null }
  if (secure.error) throw secure.error
  if (secure.data) return secure.data
  const legacy = await db.from('customers').select('id,name,phone').eq('phone', phone).maybeSingle()
  if (legacy.error) throw legacy.error
  return legacy.data
}

async function eligibleItems(phone: string) {
  const customer = await customerForPhone(phone)
  if (!customer) return { customer: null, items: [] as Array<{ product: Product; order: Order }> }
  const phoneHash = piiHash(normalizePhoneForHash(phone))
  const orderOwnerFilters = [`customer_id.eq.${customer.id}`, `customer_phone.eq.${phone}`]
  if (phoneHash) orderOwnerFilters.push(`pii_phone_hash.eq.${phoneHash}`)
  const ordersResult = await db.from('orders').select('id,ref,items,delivered_at,updated_at')
    .or(orderOwnerFilters.join(',')).eq('status', 'delivered').or('grand_total.gt.0,total_amount.gt.0').order('updated_at', { ascending: false }).limit(500)
  if (ordersResult.error) throw ordersResult.error
  const orders = (ordersResult.data || []) as Order[]
  const names = [...new Set(orders.flatMap(order => itemNames(order.items)).map(normalizeName))]
  if (!names.length) return { customer, items: [] as Array<{ product: Product; order: Order }> }
  const productsResult = await db.from('products').select('id,name,image_url,images').limit(500)
  if (productsResult.error) throw productsResult.error
  const products = (productsResult.data || []) as Product[]
  const byName = new Map(products.map(product => [normalizeName(product.name), product]))
  const seen = new Set<string>()
  const items: Array<{ product: Product; order: Order }> = []
  for (const order of orders) for (const name of itemNames(order.items)) {
    const product = byName.get(normalizeName(name))
    if (product && !seen.has(product.id)) { items.push({ product, order }); seen.add(product.id) }
  }
  return { customer, items }
}

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  if (rejectUnexpectedOrigin(request)) return NextResponse.json({ error: 'Untrusted origin' }, { status: 403, headers })
  const session = customerSessionFromRequest(request); if (!session) return unauthorized(request)
  try {
    const { customer, items } = await eligibleItems(session.phone)
    if (!customer) return NextResponse.json({ reviews: [] }, { headers })
    const ids = items.map(item => item.product.id)
    const reviewsResult = ids.length ? await db.from('product_reviews').select('id,product_id,status,rating,review,photo_path,reward_points,created_at').eq('customer_phone', session.phone).in('product_id', ids) : { data: [], error: null }
    if (reviewsResult.error) throw reviewsResult.error
    const reviews = new Map((reviewsResult.data || []).map(review => [review.product_id, review]))
    return NextResponse.json({ reviews: items.map(({ product, order }) => {
      const review = reviews.get(product.id) as Record<string, unknown> | undefined
      return {
        product_id: product.id, product_name: product.name, product_image: publicImage(product), order_ref: order.ref,
        delivered_at: order.delivered_at || order.updated_at, status: review?.status || 'ready', rating: review?.rating || null,
        review: review?.review || '', has_photo: Boolean(review?.photo_path), reward_points: Number(review?.reward_points || 0), submitted_at: review?.created_at || null,
      }
    }) }, { headers })
  } catch (error) { console.error('Customer review list failed', error); return NextResponse.json({ error: 'Unable to load your reviewable treats.' }, { status: 500, headers }) }
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  if (rejectUnexpectedOrigin(request)) return NextResponse.json({ error: 'Untrusted origin' }, { status: 403, headers })
  const session = customerSessionFromRequest(request); if (!session) return unauthorized(request)
  const limited = await rateLimit(request, 'customer-review-submit', 5, 60 * 60 * 1000, session.phone); if (limited) return limited
  let uploadedPath = ''
  try {
    const form = await request.formData()
    const productId = cleanText(form.get('product_id'), 60)
    const rating = Number(form.get('rating'))
    const review = cleanText(form.get('review'), 1500)
    const photo = form.get('photo')
    if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isInteger(rating) || rating < 1 || rating > 5 || review.length < 8) return NextResponse.json({ error: 'Choose a rating and write at least a short review.' }, { status: 400, headers })
    const { customer, items } = await eligibleItems(session.phone)
    const item = items.find(candidate => candidate.product.id === productId)
    if (!customer || !item) return NextResponse.json({ error: 'You can review only a treat from a paid, delivered order.' }, { status: 403, headers })
    if (photo instanceof File && photo.size) {
      if (!PHOTO_TYPES.has(photo.type) || photo.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Use a JPG, PNG, or WebP dog photo smaller than 5 MB.' }, { status: 400, headers })
      const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg'
      uploadedPath = `${customer.id}/${randomUUID()}.${extension}`
      const upload = await db.storage.from(PHOTO_BUCKET).upload(uploadedPath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, upsert: false })
      if (upload.error) throw upload.error
    }
    const { data: existing, error: existingError } = await db.from('product_reviews').select('id').eq('customer_phone', session.phone).eq('product_id', productId).maybeSingle()
    if (existingError) throw existingError
    if (existing) { if (uploadedPath) await db.storage.from(PHOTO_BUCKET).remove([uploadedPath]); return NextResponse.json({ error: 'You have already submitted a review for this treat.' }, { status: 409, headers }) }
    const insert = await db.from('product_reviews').insert({ product_id: productId, product_name: item.product.name, customer_name: customer.name || 'Game of Bones dog parent', customer_phone: session.phone, rating, review, status: 'pending', order_id: item.order.id, photo_path: uploadedPath || null }).select('id').single()
    if (insert.error) throw insert.error
    return NextResponse.json({ ok: true, status: 'pending', message: 'Thank you — your review is with our team for moderation.' }, { status: 201, headers })
  } catch (error) {
    if (uploadedPath) await db.storage.from(PHOTO_BUCKET).remove([uploadedPath])
    console.error('Customer review submit failed', error)
    return NextResponse.json({ error: 'Unable to submit your review. Please try again.' }, { status: 500, headers })
  }
}
