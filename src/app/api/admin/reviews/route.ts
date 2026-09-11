import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

const REVIEW_POINTS = 50

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const status = request.nextUrl.searchParams.get('status')
  const query = database().from('reviews').select('*').order('created_at', { ascending: false }).limit(500)
  if (status === 'pending' || status === 'approved' || status === 'rejected') query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load reviews.' }, { status: 500 })
  return NextResponse.json({ reviews: data || [] })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = (await request.json().catch(() => null) || {}) as Record<string, unknown>
  const id = text(body.id, 100)
  const action = text(body.action, 20)
  if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Choose a review and an action.' }, { status: 400 })

  const db = database()
  const { data: review, error: reviewError } = await db.from('reviews')
    .select('id,customer_phone,customer_name,status,review_points_awarded_at')
    .eq('id', id).maybeSingle()
  if (reviewError || !review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 })

  if (action === 'reject') {
    const { error } = await db.from('reviews').update({ status: 'rejected', approved_at: null, approved_by: null }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Unable to reject review.' }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  if (review.review_points_awarded_at) return NextResponse.json({ ok: true, status: 'approved', alreadyAwarded: true })

  const phone = text(review.customer_phone, 20)
  if (!phone) return NextResponse.json({ error: 'This review has no customer phone number, so points cannot be awarded.' }, { status: 400 })
  const { data: customer, error: customerError } = await db.from('customers').select('id,name,phone,loyalty_points').eq('phone', phone).maybeSingle()
  if (customerError || !customer) return NextResponse.json({ error: 'No customer profile matches this review. Review approval cannot award points yet.' }, { status: 400 })

  const now = new Date().toISOString()
  const { error: rewardError } = await db.from('rewards').insert({
    review_id: String(review.id),
    customer_phone: phone,
    customer_name: text(review.customer_name, 120) || customer.name || null,
    type: 'review',
    description: `${REVIEW_POINTS} points earned for an approved review`,
    coupon_code: null,
    discount_value: REVIEW_POINTS,
    is_used: false,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // The unique review_id index from the migration is the idempotency guard.
  if (rewardError && rewardError.code !== '23505') return NextResponse.json({ error: 'Unable to create review points.' }, { status: 500 })
  const alreadyAwarded = rewardError?.code === '23505'

  if (!alreadyAwarded) {
    const { error: customerUpdateError } = await db.from('customers').update({ loyalty_points: Number(customer.loyalty_points || 0) + REVIEW_POINTS }).eq('id', customer.id)
    if (customerUpdateError) return NextResponse.json({ error: 'Review points were created, but the customer balance could not be updated.' }, { status: 500 })
  }

  const { error: approvalError } = await db.from('reviews').update({ status: 'approved', approved_at: now, approved_by: 'admin', review_points_awarded_at: now }).eq('id', id)
  if (approvalError) return NextResponse.json({ error: 'Points were created, but the review status could not be updated.' }, { status: 500 })
  await db.from('activity_log').insert({ action: 'review approved', entity_type: 'review', entity_id: id, entity_name: text(review.customer_name, 120) || 'Customer review', details: alreadyAwarded ? 'Review approved; its existing 50-point reward was preserved.' : `Review approved and ${REVIEW_POINTS} points awarded.` })
  return NextResponse.json({ ok: true, status: 'approved', pointsAwarded: alreadyAwarded ? 0 : REVIEW_POINTS, alreadyAwarded })
}
