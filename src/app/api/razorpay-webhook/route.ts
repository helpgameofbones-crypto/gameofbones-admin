import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Same reversible XOR+base64 scheme used everywhere else in this codebase
// (see orders/page.tsx decryptData) so that a self-healed order's
// phone/email/address show up correctly on the admin Orders page instead
// of as raw plaintext next to every other (encrypted) order.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'
function encryptData(data: string): string {
  if (!data) return ''
  try {
    const bytes = Array.from(data).map((c, i) => c.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    return Buffer.from(bytes).toString('base64')
  } catch {
    return data
  }
}

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
      const { data: existing } = await supabase.from('orders').select('id').eq('ref', orderId).limit(1)

      if (existing && existing.length > 0) {
        await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('ref', orderId)
      } else {
        // SAFETY NET: previously this branch didn't exist, so a captured
        // Razorpay payment whose client-side order save never landed (tab
        // closed / network blip / JS error right after payment) silently
        // vanished -- the UPDATE above matched zero rows and nobody was
        // ever notified the customer had been charged with no order on
        // file. Create a minimal placeholder order instead so the payment
        // can never be lost, clearly flagged for manual review since
        // Razorpay's payload doesn't carry the full cart the client-side
        // save would have included.
        const addressNote = payment.notes?.address || ''
        const customerNoteName = payment.notes?.customer_name || ''
        const amountRupees = (payment.amount || 0) / 100
        const contact = payment.contact ? String(payment.contact).replace(/^\+?91/, '') : ''
        await supabase.from('orders').insert({
          ref: orderId || ('RZP-' + payment.id),
          customer_name: customerNoteName || null,
          customer_email: payment.email ? encryptData(payment.email) : null,
          customer_phone: contact ? encryptData(contact) : null,
          shipping_address: { street: encryptData(addressNote), city: '', state: '', pincode: '' },
          items: [],
          subtotal: amountRupees,
          discount: 0,
          shipping: 0,
          packaging: 0,
          grand_total: amountRupees,
          total_amount: amountRupees,
          payment_method: 'razorpay',
          payment_status: 'paid',
          transaction_id: payment.id,
          status: 'placed',
          notes: '\u26a0\ufe0f AUTO-RECOVERED from Razorpay webhook \u2014 the client-side order save never completed after payment. Item details unavailable here; verify with the customer (phone/email above, or Razorpay payment ' + payment.id + ') before shipping.',
          created_at: new Date().toISOString()
        })
      }
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
