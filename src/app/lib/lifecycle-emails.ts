import { resend } from '@/app/lib/emailClient'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

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
    html: `<!doctype html><html><body style="margin:0;background:#f7f0e4;font-family:Arial,sans-serif;color:#082f26">
      <div style="max-width:600px;margin:0 auto;padding:28px 16px">
        <div style="background:#082f26;padding:28px;text-align:center"><strong style="color:#d28b21;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:1.5px">GAME OF BONES</strong></div>
        <div style="background:#fffdf8;padding:32px;text-align:center">
          <p style="margin:0 0 12px;font-size:14px;color:#a86913;letter-spacing:1px;font-weight:700">WELCOME TO THE PACK</p>
          <h1 style="margin:0 0 16px;font-size:30px">You spun ${prize}!</h1>
          <p style="line-height:1.6">Hi ${firstName}, your reward is ready. Use this code at checkout:</p>
          <div style="margin:24px auto;padding:16px;background:#f9e7a5;border:1px dashed #a86913;font-size:24px;font-weight:700;letter-spacing:2px">${coupon}</div>
          <a href="https://gameofbones.in/products" style="display:inline-block;background:#c88722;color:#fff;padding:14px 24px;text-decoration:none;font-weight:700">SHOP TREATS →</a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b6257">One spin per person. Your reward will be checked at checkout.</p>
        </div>
      </div>
    </body></html>`,
  })
}

export async function sendOrderPlacedEmail(order: any) {
  const email = customerEmail(order.customer_email)
  if (!email) return false
  const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
  const ref = escapeHtml(order.ref)
  const total = Number(order.grand_total || 0).toLocaleString('en-IN')
  const itemLines = (order.items || []).slice(0, 5).map((item: any) =>
    `<li style="padding:5px 0">${escapeHtml(item.product_name || item.name || 'Treat')} × ${Number(item.quantity ?? item.qty ?? 1)}</li>`
  ).join('')
  await resend.emails.send({
    to: email,
    subject: `Order confirmed: ${ref}`,
    html: `<!doctype html><html><body style="margin:0;background:#f7f0e4;font-family:Arial,sans-serif;color:#082f26"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#082f26;padding:28px;text-align:center"><strong style="color:#d28b21;letter-spacing:2px">GAME OF BONES</strong></div><div style="background:#fffdf8;padding:32px"><h1 style="margin-top:0">Your order is confirmed.</h1><p>Hi ${firstName}, thank you for your order. We will email your Delhivery tracking link as soon as it is dispatched.</p><p><strong>Order:</strong> ${ref}<br><strong>Total:</strong> ₹${total}</p><ul style="padding-left:20px">${itemLines}</ul><a href="https://gameofbones.in/track" style="display:inline-block;margin-top:16px;background:#c88722;color:#fff;padding:14px 24px;text-decoration:none;font-weight:700">TRACK MY ORDER →</a></div></div></body></html>`,
  })
  return true
}

export async function sendDispatchEmail(order: any, awb: string) {
  const email = customerEmail(order.customer_email)
  if (!email) return false
  const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
  const trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`
  await resend.emails.send({
    to: email,
    subject: `Your Game of Bones order is on its way: ${awb}`,
    html: `<!doctype html><html><body style="margin:0;background:#f7f0e4;font-family:Arial,sans-serif;color:#082f26"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#082f26;padding:28px;text-align:center"><strong style="color:#d28b21;letter-spacing:2px">GAME OF BONES</strong></div><div style="background:#fffdf8;padding:32px"><h1 style="margin-top:0">Your treats are on the way.</h1><p>Hi ${firstName}, your shipment has been booked with Delhivery.</p><p><strong>Tracking number:</strong> ${escapeHtml(awb)}</p><a href="${trackingUrl}" style="display:inline-block;background:#c88722;color:#fff;padding:14px 24px;text-decoration:none;font-weight:700">TRACK WITH DELHIVERY →</a></div></div></body></html>`,
  })
  return true
}
