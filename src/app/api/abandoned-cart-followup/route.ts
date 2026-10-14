import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'
import { resend } from '@/app/lib/emailClient'
import { escapeHtml, isFirstOrderCustomer, itemsHtml as renderItems, offerBox, restoreLink, text, WELCOME_CODE, type RecoveryItem } from '@/app/lib/cart-recovery'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// A shopper who goes on to order (often within minutes) must never get a
// "you left treats in your cart" email. The orders trigger marks such carts
// recovered, but we also re-check here right before sending.
async function hasOrderedSince(cart: { abandoned_at?: string; pii_phone_hash?: string | null; pii_email_hash?: string | null }): Promise<boolean> {
  const hashes = [
    cart.pii_phone_hash ? `pii_phone_hash.eq.${cart.pii_phone_hash}` : '',
    cart.pii_email_hash ? `pii_email_hash.eq.${cart.pii_email_hash}` : '',
  ].filter(Boolean)
  if (!hashes.length) return false
  const since = new Date(new Date(cart.abandoned_at || Date.now()).getTime() - 15 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('orders')
    .select('id,status')
    .or(hashes.join(','))
    .gte('created_at', since)
    .limit(10)
  // If we cannot check, err on the side of not emailing.
  if (error) return true
  return (data || []).some((o: { status?: string | null }) => {
    const status = String(o.status || '')
    return status !== 'pending_payment' && !/^cancel/i.test(status)
  })
}

// Cron job: originally ran every hour and swept a tight 1-2h window, but
// Vercel's Hobby plan only allows crons to run once per day (anything more
// frequent fails at deploy time -- see vercel.json). Now runs once daily and
// sweeps a full rolling ~25h window instead, so a cart abandoned at any point
// since the previous run still gets caught. The old hourly version relied on
// each cart falling into its narrow window exactly once as the *only* guard
// against duplicate emails; that's no longer safe with a wider window (a
// cart sitting abandoned for several days would otherwise re-match every
// day), so this also checks/sets followup_sent_at as an explicit dedup flag.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const windowStart = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25h ago
  const oneHourAgo  = new Date(Date.now() - 1 * 60 * 60 * 1000)  // still give an
    // active shopper at least 1h before following up, same buffer as before

  const { data: carts } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('recovered', false)
    .is('followup_sent_at', null)
    .not('customer_email', 'is', null)
    .gte('abandoned_at', windowStart.toISOString())
    .lt('abandoned_at', oneHourAgo.toISOString())

  let sent = 0
  for (const cart of carts || []) {
    if (await hasOrderedSince(cart)) {
      await supabase.from('abandoned_carts').update({ recovered: true }).eq('id', cart.id)
      continue
    }
    const items = Array.isArray(cart.items) ? cart.items as RecoveryItem[] : []
    const itemsHtml = await renderItems(supabase, items)
    // New customers get WELCOME15 (15% off a first order). Returning customers
    // keep the private 10% code created when they saved their bag, if any.
    const firstOrder = await isFirstOrderCustomer(supabase, cart.pii_phone_hash || null, cart.pii_email_hash || null)
    const couponCode = firstOrder ? WELCOME_CODE : text(cart.coupon_code)
    const couponLabel = firstOrder ? '15% off your first order' : '10% off'
    const firstName = escapeHtml(text(cart.customer_name).split(' ')[0] || 'there')
    const total = Math.max(0, Number(cart.total) || 0).toLocaleString('en-IN')
    const recoveryUrl = await restoreLink(supabase, cart, couponCode || null)
    const html = lifecycleEmailTemplate({
      eyebrow: 'Your treats are waiting',
      title: 'Your pup’s treats are still in the bowl.',
      introHtml: `Hi ${firstName}, you left these treats in your cart. We’ve saved them for you.`,
      detailHtml: `${emailCard(`${itemsHtml}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:14px;font-size:15px;font-weight:700">TOTAL</td><td align="right" style="padding-top:14px;font-size:17px;font-weight:700">₹${total}</td></tr></table>`, 'left')}${couponCode ? offerBox(couponCode, couponLabel) : ''}`,
      ctaLabel: 'Complete my order',
      ctaUrl: recoveryUrl,
    })

    // Sent through Resend (verified domain); emailClient falls back to Gmail
    // only if Resend is not configured.
    const result = await resend.emails.send({
      to: cart.customer_email,
      subject: `${cart.customer_name?.split(' ')[0] || 'Hey'}, your dog treats are waiting! 🐾`,
      html,
    }) as { error?: unknown } | undefined
    if (result && result.error) {
      console.error('abandoned-cart-followup: send failed', cart.id, result.error)
      continue
    }

    // Mark sent immediately so a second cron run (retry, or the query
    // matching the same row twice due to clock drift) never double-emails.
    await supabase
      .from('abandoned_carts')
      .update({ followup_sent_at: new Date().toISOString() })
      .eq('id', cart.id)

    sent++
  }

  return NextResponse.json({ sent })
}
