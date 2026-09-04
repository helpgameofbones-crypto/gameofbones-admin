import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { protectLegacyPii } from '@/app/lib/pii-crypto'

export const maxDuration = 20

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
                      const contact = payment.contact ? String(payment.contact).replace(/^\+?91/, '') : ''; let recoveredItems: any[] = []; let recoveredSubtotal: number | null = null; let recoveredAddress: string | null = null; let recoverySource: string | null = null; if (payment.notes) { try { const notesItemsRaw = ['items_1','items_2','items_3'].map(function(k){ return (payment.notes as any)[k] || '' }).join(''); if (notesItemsRaw) { const notesItems = JSON.parse(notesItemsRaw); if (Array.isArray(notesItems) && notesItems.length > 0) { recoveredItems = notesItems.map(function(i: any){ return { product_name: i.n, pack_label: i.s || null, pack_price: (i.p != null ? i.p : null), quantity: i.q || 1 } }); recoverySource = 'razorpay_notes'; } } } catch (e) {} } if (recoveredItems.length === 0 && orderId) { const attemptRetryDelaysMs = [0, 1500, 2500]; for (const attemptDelay of attemptRetryDelaysMs) { if (attemptDelay) await sleep(attemptDelay); const { data: attemptMatch } = await supabase.from('order_attempts').select('items, subtotal, shipping_address, customer_phone, customer_email').eq('ref', orderId).limit(1).maybeSingle(); if (attemptMatch && Array.isArray(attemptMatch.items) && attemptMatch.items.length > 0) { recoveredItems = attemptMatch.items.map(function(i: any){ return { product_name: i.name || i.product_name, pack_label: i.size || i.pack_label || null, pack_price: (i.unit_price != null ? i.unit_price : (i.pack_price != null ? i.pack_price : null)), quantity: i.qty || i.quantity || 1 } }); recoveredSubtotal = Number(attemptMatch.subtotal) || null; recoveredAddress = attemptMatch.shipping_address || null; recoverySource = 'order_attempts'; break } } } if (recoveredItems.length === 0 && contact) { const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); const { data: cartMatches } = await supabase.from('abandoned_carts').select('items, total, abandoned_at').eq('customer_phone', contact).gte('abandoned_at', windowStart).order('abandoned_at', { ascending: false }).limit(1); if (cartMatches && cartMatches.length > 0 && Array.isArray(cartMatches[0].items) && cartMatches[0].items.length > 0) { recoveredItems = cartMatches[0].items; recoveredSubtotal = Number(cartMatches[0].total) || null; recoverySource = 'abandoned_carts'; } } const itemsRecovered = recoveredItems.length > 0; const subtotalRupees = recoveredSubtotal ?? amountRupees; const discountRupees = itemsRecovered ? Math.max(0, subtotalRupees - amountRupees) : 0;
                      await supabase.from('orders').insert({
                                  ref: orderId || ('RZP-' + payment.id),
                                  customer_name: customerNoteName || null,
                                  customer_email: payment.email ? protectLegacyPii(payment.email) : null,
                                  customer_phone: contact ? protectLegacyPii(contact) : null,
                                  shipping_address: { street: protectLegacyPii(recoveredAddress || addressNote), city: '', state: '', pincode: '' },
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
                                  notes: itemsRecovered ? ('⚠️ AUTO-RECOVERED from Razorpay webhook — the client-side order save never completed after payment. Items were recovered from ' + (recoverySource === 'order_attempts' ? 'the exact checkout-attempt record (ref match)' : 'a matching abandoned-cart record (phone match, within 3h)') + '; please double-check against the customer before shipping.') : '⚠️ AUTO-RECOVERED from Razorpay webhook — the client-side order save never completed after payment (even after retrying). Item details unavailable here (no matching checkout-attempt or abandoned-cart record found); verify with the customer (phone/email above, or Razorpay payment ' + payment.id + ') before shipping.',
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
