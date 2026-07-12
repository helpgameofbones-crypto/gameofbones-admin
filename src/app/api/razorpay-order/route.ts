import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { corsHeaders } from '@/app/lib/cors'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const { amount, currency = 'INR', receipt, notes } = await req.json()
    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400, headers })
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: receipt || 'GOB-' + Date.now(),
      notes: notes || {},
    })
    return NextResponse.json({
      order_id: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID,
    }, { headers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500, headers })
  }
}
