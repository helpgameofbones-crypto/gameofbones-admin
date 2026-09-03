import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizePhoneForHash, piiHash, revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-loyalty-summary', 5, 60 * 60 * 1000); if (limitError) return limitError
    const phone = normalizePhoneForHash(cleanText((await req.json()).phone, 20))
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ points: 0 }, { headers })
    const phoneHash = piiHash(phone)
    const [ordersResult, referralsResult, rewardsResult, customerResult] = await Promise.all([
      supabase.from('orders').select('ref,created_at,grand_total,total_amount,customer_phone,pii_phone_ciphertext,pii_phone_hash').limit(5000),
      supabase.from('referrals').select('points_awarded').eq('referrer_phone', phone),
      supabase.from('rewards').select('discount_value').eq('customer_phone', phone).eq('type', 'review'),
      supabase.from('customers').select('loyalty_points').eq('phone', phone).limit(1),
    ])
    if (ordersResult.error || referralsResult.error || rewardsResult.error || customerResult.error) throw new Error('Unable to load loyalty summary')
    const orders = (ordersResult.data || []).filter(order => order.pii_phone_hash === phoneHash || normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone)) === phone)
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.grand_total || order.total_amount || 0), 0)
    const spendPoints = Math.floor(totalSpent / 10)
    const referralPoints = (referralsResult.data || []).reduce((sum, referral) => sum + Number(referral.points_awarded || 0), 0)
    const reviewPoints = (rewardsResult.data || []).reduce((sum, reward) => sum + Number(reward.discount_value || 0), 0)
    const profilePoints = Number(customerResult.data?.[0]?.loyalty_points || 0)
    const recentOrders = orders
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
      .slice(0, 5)
      .map(order => ({ ref: order.ref, createdAt: order.created_at, total: Number(order.grand_total || order.total_amount || 0) }))
    return NextResponse.json({ points: Math.max(spendPoints + referralPoints + reviewPoints, profilePoints), orderCount: orders.length, totalSpent, recentOrders }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to load loyalty points' }, { status: 500, headers }) }
}
