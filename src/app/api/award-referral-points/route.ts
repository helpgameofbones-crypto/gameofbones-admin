import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

const REFERRAL_POINTS = 300
const POINTS_EXPIRY_DAYS = 60

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, ref, customer_id, customer_name, referrer_code, referrer_points_credited, status')
    .eq('status', 'delivered')
    .not('referrer_code', 'is', null)
    .or('referrer_points_credited.is.null,referrer_points_credited.eq.false')
    .limit(200)

if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
}

let credited = 0
  const results: any[] = []

    for (const order of (orders || [])) {
        try {
              const code = (order.referrer_code || '').trim().toUpperCase()
              if (!code) {
                      results.push({ ref: order.ref, skipped: 'no referrer code' })
                      continue
              }

          const { data: referrer } = await supabase
                .from('customers')
                .select('id, name, phone, loyalty_points')
                .eq('referral_code', code)
                .maybeSingle()

          if (!referrer) {
                  results.push({ ref: order.ref, skipped: 'no customer with that referral_code: ' + code })
                  continue
          }

          if (!order.customer_id) {
                  results.push({ ref: order.ref, skipped: 'order has no linked customer_id' })
                  continue
          }

          const { data: referred } = await supabase
                .from('customers')
                .select('id, name, phone, loyalty_points')
                .eq('id', order.customer_id)
                .maybeSingle()

          if (!referred) {
                  results.push({ ref: order.ref, skipped: 'no customer row for order.customer_id' })
                  continue
          }

          if (referrer.id === referred.id) {
                  await supabase.from('orders').update({ referrer_points_credited: true }).eq('id', order.id)
                  results.push({ ref: order.ref, skipped: 'referrer and referred are the same customer' })
                  continue
          }

          const expiresAt = new Date(Date.now() + POINTS_EXPIRY_DAYS * 86400000).toISOString()

          await supabase.from('customers').update({
                  loyalty_points: (referrer.loyalty_points || 0) + REFERRAL_POINTS,
                  loyalty_points_expire_at: expiresAt,
          }).eq('id', referrer.id)

          await supabase.from('customers').update({
                  loyalty_points: (referred.loyalty_points || 0) + REFERRAL_POINTS,
                  loyalty_points_expire_at: expiresAt,
          }).eq('id', referred.id)

          await supabase.from('referrals').insert({
                  referrer_phone: referrer.phone,
                  referred_phone: referred.phone,
                  order_id: order.id,
                  points_awarded: REFERRAL_POINTS,
                  created_at: new Date().toISOString(),
          })

          await supabase.from('orders').update({ referrer_points_credited: true }).eq('id', order.id)

          await supabase.from('activity_log').insert([
            {
                      action: 'loyalty points added',
                      entity_type: 'customer',
                      entity_id: referrer.id,
                      entity_name: referrer.name,
                      details: '+' + REFERRAL_POINTS + ' points - referral bonus for referring ' + referred.name + ' (order ' + order.ref + ')',
            },
            {
                      action: 'loyalty points added',
                      entity_type: 'customer',
                      entity_id: referred.id,
                      entity_name: referred.name,
                      details: '+' + REFERRAL_POINTS + " points - referral bonus for using " + referrer.name + "'s code on order " + order.ref,
            },
                ])

          credited++
              results.push({ ref: order.ref, referrer: referrer.name, referred: referred.name, pointsEach: REFERRAL_POINTS })
        } catch (e: any) {
              results.push({ ref: order.ref, error: e.message })
        }
    }

return NextResponse.json({
    ok: true,
    orders_checked: orders?.length || 0,
    credited,
    results,
})
}
