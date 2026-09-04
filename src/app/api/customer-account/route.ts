import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { customerSessionFromRequest } from '@/app/lib/customer-session'
import { cleanText, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function unauthorized(request: NextRequest) { return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers: corsHeaders(request) }) }
function first<T>(value: T[] | null) { return Array.isArray(value) ? value[0] || null : null }

export async function OPTIONS(request: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(request) }) }

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  if (rejectUnexpectedOrigin(request)) return NextResponse.json({ error: 'Untrusted origin' }, { status: 403, headers })
  const session = customerSessionFromRequest(request); if (!session) return unauthorized(request)
  try {
    const phone = session.phone
    const [profileResult, addressesResult, dogsResult, rewardsResult, referralResult, ordersResult] = await Promise.all([
      supabase.rpc('get_customer_profile', { p_phone: phone }),
      supabase.rpc('get_customer_addresses', { p_phone: phone }),
      supabase.rpc('get_customer_dogs', { p_phone: phone }),
      supabase.rpc('get_customer_rewards', { p_phone: phone }),
      supabase.rpc('get_or_create_referral_code', { p_phone: phone, p_name: '' }),
      supabase.rpc('get_customer_order_history', { p_phone: phone }),
    ])
    if (profileResult.error || addressesResult.error || dogsResult.error || rewardsResult.error || referralResult.error || ordersResult.error) throw new Error('Account data unavailable')
    const rewards = (rewardsResult.data || []) as Array<{ loyalty_points?: number; reward_id?: string; description?: string; coupon_code?: string }>
    const orders = (ordersResult.data || []) as Array<{ loyalty_points_redeemed?: number }>
    const pointsRedeemed = orders.reduce((total: number, order: { loyalty_points_redeemed?: number }) => total + Number(order.loyalty_points_redeemed || 0), 0)
    return NextResponse.json({
      profile: first(profileResult.data), addresses: addressesResult.data || [], dogs: dogsResult.data || [], orders,
      rewards, referral: first(referralResult.data),
      points: { available: Number(first(rewards)?.loyalty_points || 0), redeemed: pointsRedeemed, earnWays: ['Earn 1 point for every ₹10 spent', 'Earn 300 points when a referred friend completes their first order', 'Earn points when you leave a verified review'] },
    }, { headers })
  } catch (error) { console.error('Customer account load failed', error); return NextResponse.json({ error: 'Unable to load your account.' }, { status: 500, headers }) }
}

export async function PATCH(request: NextRequest) {
  const headers = corsHeaders(request)
  if (rejectUnexpectedOrigin(request)) return NextResponse.json({ error: 'Untrusted origin' }, { status: 403, headers })
  const session = customerSessionFromRequest(request); if (!session) return unauthorized(request)
  try {
    const body = await request.json(); const action = cleanText(body.action, 30)
    if (action === 'contact') {
      const name = cleanText(body.name, 100); const email = cleanText(body.email, 254).toLowerCase()
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter your name and a valid email address.' }, { status: 400, headers })
      const { error } = await supabase.rpc('update_customer_contact', { p_phone: session.phone, p_name: name, p_email: email }); if (error) throw error
    } else if (action === 'dog') {
      const name = cleanText(body.name, 80); const birthday = cleanText(body.birthday, 10) || null
      if (!name || (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday))) return NextResponse.json({ error: 'Enter your dog’s name and a valid birthday.' }, { status: 400, headers })
      const { error } = await supabase.rpc('upsert_customer_dog', { p_id: cleanText(body.id, 60) || null, p_phone: session.phone, p_name: name, p_breed: cleanText(body.breed, 80), p_age: cleanText(body.age, 30), p_weight: cleanText(body.weight, 30), p_preferences: cleanText(body.preferences, 500), p_birthday: birthday }); if (error) throw error
    } else if (action === 'address') {
      const line1 = cleanText(body.line1, 180); const city = cleanText(body.city, 80); const state = cleanText(body.state, 80); const pincode = cleanText(body.pincode, 6)
      if (!line1 || !city || !state || !/^\d{6}$/.test(pincode)) return NextResponse.json({ error: 'Complete your delivery address, including a six-digit pincode.' }, { status: 400, headers })
      const args = { p_phone: session.phone, p_label: cleanText(body.label, 40) || 'Home', p_line1: line1, p_line2: cleanText(body.line2, 180), p_city: city, p_state: state, p_pincode: pincode, p_is_default: Boolean(body.isDefault) }
      const { error } = cleanText(body.id, 60) ? await supabase.rpc('update_customer_address', { ...args, p_id: cleanText(body.id, 60) }) : await supabase.rpc('add_customer_address', args); if (error) throw error
    } else return NextResponse.json({ error: 'Unknown account update.' }, { status: 400, headers })
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) { console.error('Customer account update failed', error); return NextResponse.json({ error: 'Unable to save that change.' }, { status: 500, headers }) }
}
