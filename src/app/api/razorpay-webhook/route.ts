import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    const sigBuf = Buffer.from(signature || '', 'utf8')
    const expectedBuf = Buffer.from(expectedSignature, 'utf8')
    const isValid = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const orderId = payment.notes?.order_ref || payment.order_id
      await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('ref', orderId)
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      const orderId = payment.notes?.order_ref
      if (orderId) {
        await supabase.from('orders').update({ payment_status: 'failed' }).eq('ref', orderId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
