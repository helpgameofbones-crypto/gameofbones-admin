import { resend } from '@/app/lib/emailClient'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { couponCard, emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'
import { marketingUnsubscribeUrl } from '@/app/lib/marketing-unsubscribe'

type OrderItem = { product_name?: unknown; name?: unknown; quantity?: unknown; qty?: unknown; pack_label?: unknown; pack_weight_grams?: unknown; weight_grams?: unknown; pack_price?: unknown; price?: unknown }
type CustomerOrder = {
  customer_email?: unknown; customer_name?: unknown; pii_email_ciphertext?: unknown; pii_name_ciphertext?: unknown
  ref?: unknown; grand_total?: unknown; subtotal?: unknown; total_amount?: unknown; discount?: unknown; packaging?: unknown
  coupon_code?: unknown; loyalty_points_redeemed?: unknown; items?: unknown; delhivery_awb?: unknown
}

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

function money(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function rupees(value: unknown): string {
  return `₹${money(value).toLocaleString('en-IN')}`
}

function firstName(order: CustomerOrder): string {
  return escapeHtml(revealLegacyPii(order.pii_name_ciphertext || order.customer_name).split(' ')[0] || 'there')
}

function orderItems(order: CustomerOrder): OrderItem[] {
  return Array.isArray(order.items) ? order.items as OrderItem[] : []
}

function trackingUrl(awb: unknown): string {
  return `https://www.delhivery.com/track/package/${encodeURIComponent(String(awb || ''))}`
}

function orderSummary(order: CustomerOrder): string {
  const items = orderItems(order)
  const itemLines = items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1)
    const unitPrice = money(item.pack_price ?? item.price)
    const grams = Number(item.pack_weight_grams ?? item.weight_grams)
    const packParts = [String(item.pack_label || '').trim(), Number.isFinite(grams) && grams > 0 ? `${grams} g` : ''].filter(Boolean)
    const label = packParts.length ? ` <span style="color:#665f53">(${escapeHtml(packParts.join(' · '))})</span>` : ''
    const lineTotal = unitPrice ? `<td align="right" style="padding:8px 0;border-bottom:1px solid #eadfca;white-space:nowrap">${rupees(unitPrice * quantity)}</td>` : '<td style="padding:8px 0;border-bottom:1px solid #eadfca"></td>'
    return `<tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #eadfca">${escapeHtml(item.product_name || item.name || 'Treat')}${label} × ${quantity}</td>${lineTotal}</tr>`
  }).join('') || '<tr><td style="padding:8px 0;color:#665f53">Your Game of Bones treats</td><td></td></tr>'
  const subtotal = money(order.subtotal ?? order.total_amount)
  const totalDiscount = money(order.discount)
  const pointsRedeemed = Math.max(0, Math.floor(Number(order.loyalty_points_redeemed) || 0))
  const pointsDiscount = Math.min(100, Math.round(pointsRedeemed * 0.3), totalDiscount)
  const offerDiscount = Math.max(0, totalDiscount - pointsDiscount)
  const packaging = money(order.packaging)
  const total = money(order.grand_total)
  // Online orders receive a ₹30 saving which predates its own stored column.
  // Derive it from the persisted financial totals so this email always reconciles.
  const onlineSaving = Math.max(0, subtotal - totalDiscount + packaging - total)
  const rows = [
    `<tr><td style="padding:10px 0 0;color:#254a42">Subtotal</td><td align="right" style="padding:10px 0 0">${rupees(subtotal)}</td></tr>`,
    offerDiscount ? `<tr><td style="padding:8px 0 0;color:#254a42">${order.coupon_code ? `Coupon (${escapeHtml(order.coupon_code)})` : 'Offer discount'}</td><td align="right" style="padding:8px 0 0;color:#16824a">−${rupees(offerDiscount)}</td></tr>` : '',
    pointsDiscount ? `<tr><td style="padding:8px 0 0;color:#254a42">Points redeemed (${pointsRedeemed} points)</td><td align="right" style="padding:8px 0 0;color:#16824a">−${rupees(pointsDiscount)}</td></tr>` : '',
    onlineSaving ? `<tr><td style="padding:8px 0 0;color:#254a42">Online payment saving</td><td align="right" style="padding:8px 0 0;color:#16824a">−${rupees(onlineSaving)}</td></tr>` : '',
    packaging ? `<tr><td style="padding:8px 0 0;color:#254a42">COD handling</td><td align="right" style="padding:8px 0 0">${rupees(packaging)}</td></tr>` : '',
  ].filter(Boolean).join('')
  return emailCard(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color:#082f26;font-size:14px;text-align:left"><tr><td style="padding-bottom:12px;color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.2px">ORDER ${escapeHtml(order.ref)}</td><td align="right" style="padding-bottom:12px;color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.2px">ORDER DETAILS</td></tr>${itemLines}<tr><td colspan="2" style="padding-top:2px"></td></tr>${rows}<tr><td style="padding:13px 0 0;border-top:1px solid #d5c3a7;font-size:18px;font-weight:700">Total charged</td><td align="right" style="padding:13px 0 0;border-top:1px solid #d5c3a7;font-size:18px;font-weight:700">${rupees(total)}</td></tr></table>`, 'left')
}

export async function sendWheelWelcomeEmail(input: { name: string; email: string; couponCode: string; prize: string; gift?: boolean; game?: 'bone_run'; score?: number; minOrder?: number }) {
  const minOrder = input.minOrder ?? 499
  const boneRun = input.game === 'bone_run'
  const firstName = escapeHtml(input.name.split(' ')[0] || 'there')
  const coupon = escapeHtml(input.couponCode)
  const prize = escapeHtml(input.prize)
  return resend.emails.send({
    to: input.email,
    subject: boneRun ? `You won ${input.prize}! Place your order to get it free 🐾` : `Your Game of Bones reward: ${input.couponCode}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Welcome to the pack',
      title: boneRun ? `You won ${prize}!` : `You spun ${prize}!`,
      introHtml: input.gift
        ? `Good things happen to good pups.<br>No code needed: your free treat is added to your order automatically<br>when you check out with this email or mobile number ${minOrder > 0 ? `on an order of ₹${minOrder} or more` : 'on any order, no minimum'}.<br>It works together with your reward points and other coupons.<br><br><strong>Place your order now and get your free treat.</strong>`
        : `Good things happen to good pups.<br>Use your exclusive code at checkout and<br>treat your furry friend today.`,
      detailHtml: couponCard(coupon),
      ctaLabel: boneRun ? 'Order now & get my free treat' : 'Shop treats',
      ctaUrl: 'https://gameofbones.in/products',
      noteHtml: `Hi ${firstName}, ${boneRun ? `you scored ${Math.max(0, Math.floor(Number(input.score) || 0)).toLocaleString('en-IN')} in Bone Run. One prize per person: play again any time to upgrade it` : 'one spin per person'}. Your reward is valid for seven days and will be checked at checkout.<br><br><a href="${marketingUnsubscribeUrl(input.email)}" style="color:#254a42;text-decoration:underline">Unsubscribe from marketing emails</a>`,
    }),
  })
}

export async function sendOrderPlacedEmail(order: CustomerOrder) {
  const email = customerEmail(order.pii_email_ciphertext || order.customer_email)
  if (!email) return false
  const name = firstName(order)
  const ref = escapeHtml(order.ref)
  await resend.emails.send({
    to: email,
    subject: `Order confirmed: ${ref}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Order confirmed',
      title: 'Your order is confirmed.',
      introHtml: `Hi ${name}, thank you for your order. We’ll email your Delhivery tracking link as soon as it is dispatched.`,
      detailHtml: orderSummary(order),
      ctaLabel: 'Track my order',
      ctaUrl: 'https://gameofbones.in/track',
    }),
  })
  return true
}

export async function sendDispatchEmail(order: CustomerOrder, awb: string) {
  const email = customerEmail(order.pii_email_ciphertext || order.customer_email)
  if (!email) return false
  const name = firstName(order)
  await resend.emails.send({
    to: email,
    subject: `Your Game of Bones order is on its way: ${awb}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Dispatched',
      title: 'Your treats are on the way.',
      introHtml: `Hi ${name}, your shipment has been booked with Delhivery.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.3px">TRACKING NUMBER</div><div style="font-size:25px;font-weight:700;margin:9px 0 12px;word-break:break-all">${escapeHtml(awb)}</div><div style="border-top:1px solid #dfc988;padding-top:12px;font-size:13px;line-height:1.45">Your delivery updates will be available through Delhivery.</div>`),
      ctaLabel: 'Track with Delhivery',
      ctaUrl: trackingUrl(awb),
    }),
  })
  return true
}

export async function sendOutForDeliveryEmail(order: CustomerOrder) {
  const email = customerEmail(order.pii_email_ciphertext || order.customer_email)
  const awb = String(order.delhivery_awb || '')
  if (!email || !awb) return false
  const name = firstName(order)
  await resend.emails.send({
    to: email,
    subject: `Out for delivery today: ${escapeHtml(order.ref)}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Out for delivery',
      title: 'Your treats are arriving today.',
      introHtml: `Hi ${name}, your Game of Bones order is out for delivery with Delhivery. Please keep your phone handy for the delivery update.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.3px">ORDER & TRACKING</div><div style="font-size:20px;font-weight:700;margin:9px 0 8px">${escapeHtml(order.ref)}</div><div style="font-size:14px;color:#254a42;word-break:break-all">${escapeHtml(awb)}</div>`),
      ctaLabel: 'Track delivery',
      ctaUrl: trackingUrl(awb),
    }),
  })
  return true
}

export async function sendDeliveredEmail(order: CustomerOrder) {
  const email = customerEmail(order.pii_email_ciphertext || order.customer_email)
  if (!email) return false
  const name = firstName(order)
  const awb = String(order.delhivery_awb || '')
  await resend.emails.send({
    to: email,
    subject: `Delivered: your Game of Bones order ${escapeHtml(order.ref)}`,
    html: lifecycleEmailTemplate({
      eyebrow: 'Delivered',
      title: 'Your treats have arrived.',
      introHtml: `Hi ${name}, your Game of Bones order has been marked delivered. We hope your pup enjoys every bite.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:11px;font-weight:700;letter-spacing:1.3px">ORDER DELIVERED</div><div style="font-size:21px;font-weight:700;margin-top:9px">${escapeHtml(order.ref)}</div>${awb ? `<div style="margin-top:10px;color:#254a42;font-size:13px">Delhivery tracking: ${escapeHtml(awb)}</div>` : ''}`),
      ctaLabel: 'See my order',
      ctaUrl: 'https://gameofbones.in/track',
      noteHtml: 'For safe, happy chewing, please supervise your dog and choose a treat suited to their size and chewing style.',
    }),
  })
  return true
}
