import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mirrors the reversible XOR obfuscation used in the storefront (index.html,
// ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'). customer_email,
// customer_phone and shipping_address.street are stored run through this on
// newer orders; older orders may still have plaintext values, so callers
// below fall back to the raw value when the decrypted result doesn't look
// like real data.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'

function decryptData(encrypted: string): string {
  try {
    if (!encrypted) return ''
    const decoded = Buffer.from(encrypted, 'base64').toString('binary')
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      )
    }
    return result
  } catch (e) {
    return encrypted
  }
}

// customer_email: try decrypting; use the decrypted value only if it looks
// like an email. Handles both encrypted (new) and plaintext (old) orders.
function resolveEmail(raw: string | null | undefined): string {
  if (!raw) return ''
  if (raw.includes('@')) return raw
  const decrypted = decryptData(raw)
  if (decrypted.includes('@')) return decrypted
  return ''
}

// shipping_address.street: try decrypting; fall back to the raw value if the
// result contains control/non-printable characters (a sign decryption was
// run on an already-plaintext string).
function resolveAddressField(raw: string | null | undefined): string {
  if (!raw) return ''
  const decrypted = decryptData(raw)
  const looksGarbled = /[\x00-\x08\x0e-\x1f]/.test(decrypted)
  return looksGarbled ? raw : decrypted
}

function escapeHtml(s: any) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const { order } = await req.json()

    if (!order?.ref) {
      return NextResponse.json({ error: 'Missing ref' }, { status: 400, headers })
    }

    const { data: dbOrder, error: lookupError } = await supabase
      .from('orders')
      .select('ref, customer_name, customer_email, customer_phone, items, shipping, discount, grand_total, payment_method, shipping_address')
      .eq('ref', order.ref)
      .maybeSingle()

    if (lookupError || !dbOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers })
    }

    const resolvedEmail = resolveEmail(dbOrder.customer_email)
    const toEmail = resolvedEmail || order.customer_email || 'hello@gameofbones.in'

    const itemsHtml = (dbOrder.items || []).map((item: any) =>
      `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0ebe3;font-size:14px;color:#1a1008">${escapeHtml(item.name)}${item.size ? ' - ' + escapeHtml(item.size) : ''}</td><td style="padding:10px 16px;border-bottom:1px solid #f0ebe3;text-align:center">${item.qty}</td><td style="padding:10px 16px;border-bottom:1px solid #f0ebe3;text-align:right">Rs.${(item.price * item.qty).toLocaleString('en-IN')}</td></tr>`
    ).join('')

    const shippingAddr = dbOrder.shipping_address || {}
    const streetPlain = resolveAddressField(shippingAddr.street || shippingAddr.line1)
    const addressStr = dbOrder.shipping_address ?
      [streetPlain, shippingAddr.line2, shippingAddr.city, shippingAddr.state, shippingAddr.pincode]
        .filter(Boolean).map(escapeHtml).join(', ') : ''

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f6f2;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">
<div style="background:#1a1008;padding:28px 32px;text-align:center;border-radius:8px 8px 0 0">
<div style="font-size:22px;font-weight:700;color:#c8973a;letter-spacing:2px">GAME OF BONES</div>
<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">Premium Natural Dog Treats</div>
</div>
<div style="background:#c8973a;padding:20px 32px;text-align:center">
<div style="font-size:18px;font-weight:700;color:#1a1008">ORDER CONFIRMED</div>
<div style="font-size:13px;color:rgba(26,16,8,0.7);margin-top:4px">Thank you ${escapeHtml(dbOrder.customer_name?.split(' ')[0] || '')}! Your order is placed.</div>
</div>
<div style="background:white;padding:28px 32px">
<p style="font-size:14px;color:#8a7a6a">Order Reference: <strong style="color:#1a1008">${escapeHtml(dbOrder.ref)}</strong></p>
<p style="font-size:14px;color:#8a7a6a">Payment: <strong style="color:#1a1008">${dbOrder.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</strong></p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="background:#f9f6f2"><th style="padding:8px 16px;text-align:left;font-size:11px;color:#8a7a6a">ITEM</th><th style="padding:8px 16px;text-align:center;font-size:11px;color:#8a7a6a">QTY</th><th style="padding:8px 16px;text-align:right;font-size:11px;color:#8a7a6a">PRICE</th></tr>
${itemsHtml}
</table>
<div style="border-top:1px solid #f0ebe3;padding-top:16px;text-align:right">
${dbOrder.shipping > 0 ? '<p style="font-size:13px;color:#8a7a6a;margin:4px 0">Shipping: Rs.' + dbOrder.shipping + '</p>' : '<p style="font-size:13px;color:#16a34a;margin:4px 0">Shipping: FREE</p>'}
${dbOrder.discount > 0 ? '<p style="font-size:13px;color:#16a34a;margin:4px 0">Discount: -Rs.' + dbOrder.discount + '</p>' : ''}
<p style="font-size:16px;font-weight:700;color:#1a1008;margin:8px 0">Total: Rs.${dbOrder.grand_total?.toLocaleString('en-IN')}</p>
</div>
${addressStr ? '<p style="font-size:13px;color:#8a7a6a;margin-top:16px"><strong>Delivering to:</strong><br>' + escapeHtml(dbOrder.customer_name) + ', ' + addressStr + '</p>' : ''}
${dbOrder.payment_method === 'cod' ? '<div style="background:#fef9ec;border:1px solid #c8973a;padding:12px 16px;margin-top:16px;font-size:13px;color:#1a1008"><strong>COD:</strong> Please keep Rs.' + dbOrder.grand_total?.toLocaleString('en-IN') + ' ready at delivery.</div>' : ''}
<div style="background:#fef9ec;border:1px solid #c8973a;padding:12px 16px;margin-top:16px;font-size:13px;color:#1a1008;border-radius:4px">
<strong>What's next?</strong><br>
We'll dispatch your order within 24 hours and send you a tracking number via email. Keep an eye on your inbox! 📬
</div>
</div>
<div style="background:#1a1008;padding:20px 32px;text-align:center;border-radius:0 0 8px 8px;margin-top:2px">
<p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0">Questions? WhatsApp: <a href="https://wa.me/919082503295" style="color:#c8973a">+91 90825 03295</a></p>
</div>
</div></body></html>`

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: toEmail,
      subject: `Order Confirmed: ${dbOrder.ref}`,
      html,
    })

    return NextResponse.json({ success: true }, { headers })
  } catch (error: any) {
    console.error('Email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(req) })
  }
}
