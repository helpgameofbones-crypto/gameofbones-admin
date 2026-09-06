import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { checkoutQuote } from '@/app/lib/checkout-pricing'
import { createClient } from '@supabase/supabase-js'
import { customerSessionFromRequest } from '@/app/lib/customer-session'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})
const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function welcomeEligible(req: NextRequest) {
  const session = customerSessionFromRequest(req)
  if (!session) return false
  const { data, error } = await database.rpc('get_customer_order_history', { p_phone: session.phone })
  return !error && Array.isArray(data) && data.length === 0
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req)
    if (originError) return originError
    const limitError = rateLimit(req, 'razorpay-order', 5, 10 * 60 * 1000)
    if (limitError) return limitError
    const { items, payment_method, coupon_code, receipt, notes } = await req.json()
    const quote = await checkoutQuote(database, items, payment_method === 'online' ? 'online' : '', coupon_code, await welcomeEligible(req))
    const order = await razorpay.orders.create({
      amount: quote.grand_total * 100,
      currency: 'INR',
      receipt: receipt || 'GOB-' + Date.now(),
      notes: notes || {},
    })
    return NextResponse.json({
      order_id: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID, quote,
    }, { headers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500, headers })
  }
}
