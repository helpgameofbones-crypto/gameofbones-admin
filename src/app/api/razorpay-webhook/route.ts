import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

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

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
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

            // RACE-CONDITION GUARD: this webhook can arrive before the browser's
            // own order-save request (with the real cart items) has landed --
            // e.g. slow mobile network, or the tab backgrounded during a UPI
            // app-switch. Retry the lookup a few times with short delays before
            // falling back to the item-less placeholder insert below; most
            // "missing" orders are only a few seconds late, not actually lost.
            // (2026-08-04: GOB-E992CY and GOB-EBUBMI both hit this race and were
            // auto-recovered with empty items -- this loop is meant to stop that
            // from recurring.)
            let existing: { id: string }[] | null = null
              const retryDelaysMs = [1000, 2000, 3000, 3000]
              for (const delay of retryDelaysMs) {
                        const { data } = await supabase.from('orders').select('id').eq('ref', orderId).limit(1)
                        if (data && data.length > 0) { existing = data; break }
                        await sleep(delay)
              }
              if (!existing) {
                        const { data } = await supabase.from('orders').select('id').eq('ref', orderId).limit(1)
                        existing = data
              }

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
                      const contact = payment.contact ? String(payment.contact).replace(/^\+?91/, '') : ''; let recoveredItems: any[] = []; let recoveredSubtotal: number | null = null; if (contact) { const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); const { data: cartMatches } = await supabase.from('abandoned_carts').select('items, total, abandoned_at').eq('customer_phone', contact).gte('abandoned_at', windowStart).order('abandoned_at', { ascending: false }).limit(1); if (cartMatches && cartMatches.length > 0 && Array.isArray(cartMatches[0].items) && cartMatches[0].items.length > 0) { recoveredItems = cartMatches[0].items; recoveredSubtotal = Number(cartMatches[0].total) || null; } } const itemsRecovered = recoveredItems.length > 0; const subtotalRupees = recoveredSubtotal ?? amountRupees; const discountRupees = itemsRecovered ? Math.max(0, subtotalRupees - amountRupees) : 0;
                      await supabase.from('orders').insert({
                                  ref: orderId || ('RZP-' + payment.id),
                                  customer_name: customerNoteName || null,
                                  customer_email: payment.email ? encryptData(payment.email) : null,
                                  customer_phone: contact ? encryptData(contact) : null,
                                  shipping_address: { street: encryptData(addressNote), city: '', state: '', pincode: '' },
                                  items: recoveredItems,
                                  subtotal: subtotalRupees,
                                  discount: discountRupees,
                                  shipping: 0,
                                  packaging: 0,
                                  grand_total: amountRupees,
                                  total_amount: amountRupees,
                                  payment_method: 'razorpay',
                                  payment_status: 'paid',
                                  transaction_id: payment.id,
                                  status: 'placed',
                                  notes: itemsRecovered ? '⚠️ AUTO-RECOVERED from Razorpay webhook — the client-side order save never completed after payment. Items were recovered from a matching abandoned-cart record (phone match, within 3h); please double-check against the customer before shipping.' : '⚠️ AUTO-RECOVERED from Razorpay webhook — the client-side order save never completed after payment (even after retrying). Item details unavailable here (no matching abandoned-cart record found); verify with the customer (phone/email above, or Razorpay payment ' + payment.id + ') before shipping.',
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
