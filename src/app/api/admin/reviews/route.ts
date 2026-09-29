import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

const TEXT_REVIEW_POINTS = 100
const PHOTO_REVIEW_POINTS = 150
const PHOTO_BUCKET = 'review-photos'
function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) }
function text(value: unknown, max = 500): string { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const status = request.nextUrl.searchParams.get('status')
  const query = database().from('product_reviews').select('id,product_name,customer_name,customer_phone,rating,review,photo_path,created_at,status,reward_points,review_points_awarded_at').order('created_at', { ascending: false }).limit(500)
  if (status === 'pending' || status === 'published' || status === 'rejected') query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load reviews.' }, { status: 500 })
  const db = database()
  const reviews = await Promise.all((data || []).map(async review => {
    const photo = review.photo_path ? await db.storage.from(PHOTO_BUCKET).createSignedUrl(review.photo_path, 60 * 60) : null
    return { ...review, photo_url: photo?.data?.signedUrl || '' }
  }))
  return NextResponse.json({ reviews })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const id = text(body.id, 100), action = text(body.action, 20)
  if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Choose a review and an action.' }, { status: 400 })
  const db = database()
  const { data: review, error: reviewError } = await db.from('product_reviews').select('id,customer_phone,customer_name,product_name,photo_path,status,review_points_awarded_at,reward_points').eq('id', id).maybeSingle()
  if (reviewError || !review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 })
  if (action === 'reject') {
    const { error } = await db.from('product_reviews').update({ status: 'rejected', approved_at: null, approved_by: null }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Unable to reject review.' }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }
  if (review.review_points_awarded_at) return NextResponse.json({ ok: true, status: 'published', alreadyAwarded: true, pointsAwarded: 0 })
  const phone = text(review.customer_phone, 20)
  if (!phone) return NextResponse.json({ error: 'This review has no customer profile, so points cannot be awarded.' }, { status: 400 })
  const { data: customer, error: customerError } = await db.from('customers').select('id,name,phone,loyalty_points').eq('phone', phone).maybeSingle()
  if (customerError || !customer) return NextResponse.json({ error: 'No customer profile matches this review. Review approval cannot award points yet.' }, { status: 400 })
  const points = review.photo_path ? PHOTO_REVIEW_POINTS : TEXT_REVIEW_POINTS
  const now = new Date().toISOString()
  const { error: rewardError } = await db.from('rewards').insert({ review_id: String(review.id), customer_phone: phone, customer_name: text(review.customer_name, 120) || customer.name || null, type: 'review', description: `${points} points earned for an approved ${review.photo_path ? 'photo ' : ''}review of ${text(review.product_name, 140)}`, coupon_code: null, discount_value: points, is_used: false, expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
  if (rewardError && rewardError.code !== '23505') return NextResponse.json({ error: 'Unable to create review points.' }, { status: 500 })
  const alreadyAwarded = rewardError?.code === '23505'
  const balance = Number(customer.loyalty_points || 0) + points
  if (!alreadyAwarded) {
    const update = await db.from('customers').update({ loyalty_points: balance }).eq('id', customer.id)
    if (update.error) return NextResponse.json({ error: 'Review points were created, but the customer balance could not be updated.' }, { status: 500 })
    const ledger = await db.from('loyalty_ledger').insert({ customer_id: customer.id, customer_name: customer.name || '', customer_phone: customer.phone || phone, type: 'review', points, balance_after: balance, description: `${points} points for an approved ${review.photo_path ? 'dog-photo ' : ''}review of ${text(review.product_name, 140)}` })
    if (ledger.error) console.error('Review reward ledger entry failed', ledger.error)
  }
  const approval = await db.from('product_reviews').update({ status: 'published', approved_at: now, approved_by: 'admin', review_points_awarded_at: now, reward_points: alreadyAwarded ? Number(review.reward_points || points) : points }).eq('id', id)
  if (approval.error) return NextResponse.json({ error: 'Points were created, but the review status could not be updated.' }, { status: 500 })
  await db.from('activity_log').insert({ action: 'review published', entity_type: 'product_review', entity_id: id, entity_name: text(review.product_name, 140) || 'Customer review', details: alreadyAwarded ? 'Review published; its existing reward was preserved.' : `Review published and ${points} points awarded.` })
  return NextResponse.json({ ok: true, status: 'published', pointsAwarded: alreadyAwarded ? 0 : points, alreadyAwarded })
}
