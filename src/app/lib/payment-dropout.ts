import type { SupabaseClient } from '@supabase/supabase-js'
import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'
import { resend } from '@/app/lib/emailClient'
import { normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
import { escapeHtml, isFirstOrderCustomer, itemsHtml, offerBox, restoreLink, text, WELCOME_CODE, type RecoveryItem } from '@/app/lib/cart-recovery'

/**
 * Payment-dropout follow-up. A shopper who filled in the checkout form and
 * pressed Pay (an order_attempts row) but did not end up with an order gets
 * one email 45 minutes later with a link that restores their bag.
 *
 * Runs every 15 minutes from the scheduler (see /api/whatsapp/run).
 * One email per mobile number per attempt window; never after an order.
 */
type Attempt = {
  id: string; ref: string; created_at: string; customer_name: string | null; customer_phone: string | null
  customer_email: string | null; payment_method: string | null; grand_total: number | null; items: unknown; coupon_code: string | null
}

const DELAY_MINUTES = 45
const WINDOW_HOURS = 24
const PLACED = (status: unknown) => { const s = String(status || ''); return s !== 'pending_payment' && !/^cancel/i.test(s) }

export async function runPaymentDropoutEmails(db: SupabaseClient) {
  const out = { sent: 0, skipped_ordered: 0, failed: 0 }
  const now = Date.now()
  const { data, error } = await db.from('order_attempts')
    .select('id,ref,created_at,customer_name,customer_phone,customer_email,payment_method,grand_total,items,coupon_code')
    .is('recovery_email_at', null)
    .gte('created_at', new Date(now - WINDOW_HOURS * 3600_000).toISOString())
    .lt('created_at', new Date(now - DELAY_MINUTES * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { ...out, error: error.message }

  // Several retries by the same shopper → one email, about their latest bag.
  const groups = new Map<string, Attempt[]>()
  for (const attempt of (data || []) as Attempt[]) {
    const phone = normalizePhoneForHash(attempt.customer_phone || '')
    const key = phone || text(attempt.customer_email).toLowerCase() || attempt.id
    groups.set(key, [...(groups.get(key) || []), attempt])
  }

  for (const attempts of groups.values()) {
    const latest = attempts[0]
    const ids = attempts.map(a => a.id)
    const markHandled = () => db.from('order_attempts').update({ recovery_email_at: new Date().toISOString() }).in('id', ids)
    const phoneHash = latest.customer_phone ? piiHash(normalizePhoneForHash(latest.customer_phone)) : null
    const emailHash = latest.customer_email ? piiHash(normalizeEmailForHash(latest.customer_email)) : null
    const earliest = attempts[attempts.length - 1].created_at

    // Already ordered (same reference, or any order since by this phone/email)?
    const refs = attempts.map(a => a.ref).filter(Boolean)
    const byRef = refs.length ? await db.from('orders').select('status').in('ref', refs).limit(20) : { data: [], error: null }
    const filters = [phoneHash && `pii_phone_hash.eq.${phoneHash}`, emailHash && `pii_email_hash.eq.${emailHash}`].filter(Boolean) as string[]
    const byCustomer = filters.length
      ? await db.from('orders').select('status').or(filters.join(',')).gte('created_at', new Date(new Date(earliest).getTime() - 15 * 60_000).toISOString()).limit(20)
      : { data: [], error: null }
    if (byRef.error || byCustomer.error) continue // cannot check → try again next run
    if ([...(byRef.data || []), ...(byCustomer.data || [])].some(o => PLACED((o as { status?: unknown }).status))) {
      await markHandled(); out.skipped_ordered++; continue
    }

    const email = text(latest.customer_email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await markHandled(); continue }

    // Their saved bag (for a one-tap restore link), if the bag was tracked.
    const cartQuery = phoneHash
      ? await db.from('abandoned_carts').select('id,restore_token').eq('pii_phone_hash', phoneHash).order('abandoned_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null }
    const cart = (cartQuery.data as { id: string; restore_token: string | null } | null) || null

    const usedCode = text(latest.coupon_code).toUpperCase()
    const firstOrder = await isFirstOrderCustomer(db, phoneHash, emailHash)
    const code = usedCode || (firstOrder ? WELCOME_CODE : '')
    const codeLabel = code === WELCOME_CODE ? '15% off your first order' : code === 'CART50' ? '₹50 off your first order' : 'your saving'

    const items = Array.isArray(latest.items) ? latest.items as RecoveryItem[] : []
    const rows = await itemsHtml(db, items)
    const firstName = escapeHtml(text(latest.customer_name).split(' ')[0] || 'there')
    const total = Math.max(0, Number(latest.grand_total) || 0).toLocaleString('en-IN')
    const link = await restoreLink(db, cart, code || null)
    const html = lifecycleEmailTemplate({
      eyebrow: 'Your order is not placed yet',
      title: 'Your payment didn’t go through.',
      introHtml: `Hi ${firstName}, it looks like the payment window closed before your order was placed, so nothing was charged. Your treats are saved and ready.`,
      detailHtml: `${emailCard(`${rows}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:14px;font-size:15px;font-weight:700">TOTAL</td><td align="right" style="padding-top:14px;font-size:17px;font-weight:700">₹${total}</td></tr></table>`, 'left')}${code ? offerBox(code, codeLabel, 'on this order') : ''}`,
      ctaLabel: 'Finish my order',
      ctaUrl: link,
      noteHtml: 'Prefer to pay when it arrives? Choose <strong>Cash on Delivery</strong> at checkout. If Google Pay or PhonePe did not open, choose <strong>UPI ID</strong> or <strong>QR code</strong> in the payment window. Questions? Just reply to this email.',
    })
    const result = await resend.emails.send({ to: email, subject: `${text(latest.customer_name).split(' ')[0] || 'Hi'}, your Game of Bones order isn’t placed yet 🐾`, html }) as { error?: unknown } | undefined
    if (result && result.error) { console.error('payment-dropout: send failed', latest.ref, result.error); out.failed++; continue }
    await markHandled()
    // The daily bag reminder would repeat this message; mark it as sent too.
    if (phoneHash) await db.from('abandoned_carts').update({ followup_sent_at: new Date().toISOString() }).eq('pii_phone_hash', phoneHash).is('followup_sent_at', null)
    out.sent++
  }
  return out
}
