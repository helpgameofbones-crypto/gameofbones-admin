import { resend } from '@/app/lib/emailClient'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { couponCard, emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'

type OrderItem = { product_name?: unknown; name?: unknown; quantity?: unknown; qty?: unknown }
type CustomerOrder = { customer_email?: unknown; customer_name?: unknown; ref?: unknown; grand_total?: unknown; items?: unknown }

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function customerEmail(value: unknown): string {
  const email = revealLegacyPii(value).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export async function sendWheelWelcomeEmail(input: { name: string; email: string; couponCode: string; prize: string }) {
  const firstName = escapeHtml(input.name.split(' ')[0] || 'there')
  const coupon = escapeHtml(input.couponCode)
  const prize = escapeHtml(input.prize)
  return resend.emails.send({
    to: input.email,
    subject: `Your Game of Bones reward: ${input.couponCode}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Welcome to the pack',
      title: `You spun ${prize}!`,
      introHtml: `Good things happen to good pups.<br>Use your exclusive code at checkout and<br>treat your furry friend today.`,
      detailHtml: couponCard(coupon),
      ctaLabel: 'Shop treats',
      ctaUrl: 'https://gameofbones.in/products',
      noteHtml: `Hi ${firstName}, one spin per person. Your reward will be checked at checkout.`,
    }),
  })
}

export async function sendOrderPlacedEmail(order: CustomerOrder) {
  const email = customerEmail(order.customer_email)
  if (!email) return false
  const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
  const ref = escapeHtml(order.ref)
  const total = Number(order.grand_total || 0).toLocaleString('en-IN')
  const items = Array.isArray(order.items) ? order.items as OrderItem[] : []
  const itemLines = items.slice(0, 5).map((item) =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid #eadfca">${escapeHtml(item.product_name || item.name || 'Treat')} × ${Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1)}</td></tr>`
  ).join('')
  await resend.emails.send({
    to: email,
    subject: `Order confirmed: ${ref}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Order confirmed',
      title: 'Your order is confirmed.',
      introHtml: `Hi ${firstName}, thank you for your order. We’ll email your Delhivery tracking link as soon as it is dispatched.`,
      detailHtml: emailCard(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color:#082f26;font-size:14px;text-align:left"><tr><td style="padding-bottom:14px;color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.2px">ORDER</td><td align="right" style="padding-bottom:14px;color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.2px">TOTAL</td></tr><tr><td style="padding-bottom:16px;font-size:21px;font-weight:700">${ref}</td><td align="right" style="padding-bottom:16px;font-size:21px;font-weight:700">₹${total}</td></tr>${itemLines}</table>`, 'left'),
      ctaLabel: 'Track my order',
      ctaUrl: 'https://gameofbones.in/track',
    }),
  })
  return true
}

export async function sendDispatchEmail(order: CustomerOrder, awb: string) {
  const email = customerEmail(order.customer_email)
  if (!email) return false
  const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
  const trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`
  await resend.emails.send({
    to: email,
    subject: `Your Game of Bones order is on its way: ${awb}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Dispatched',
      title: 'Your treats are on the way.',
      introHtml: `Hi ${firstName}, your shipment has been booked with Delhivery.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.3px">TRACKING NUMBER</div><div style="font-size:25px;font-weight:700;margin:9px 0 12px;word-break:break-all">${escapeHtml(awb)}</div><div style="border-top:1px solid #dfc988;padding-top:12px;font-size:13px;line-height:1.45">Your delivery updates will be available through Delhivery.</div>`),
      ctaLabel: 'Track with Delhivery',
      ctaUrl: trackingUrl,
    }),
  })
  return true
}
