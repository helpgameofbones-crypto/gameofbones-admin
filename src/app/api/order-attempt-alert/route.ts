import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/app/lib/emailClient'
import { corsHeaders } from '@/app/lib/cors'; import { createClient } from '@supabase/supabase-js'; const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Deliberately independent of the main order-save path. The website calls
// this the moment checkout starts (before the orders row is ever written),
// for BOTH COD and prepaid. Reasoning: the /api/orders 'new order' email
// exists but sits behind requireAdmin(), so the public checkout page can
// never call it -- it has likely never fired for a single real customer
// order. And the client-side Supabase insert that actually saves the order
// can itself fail silently (tab closed/backgrounded right after payment,
// network blip, etc -- see the GOB-BUYG3U incident on 2 Aug, a captured
// Razorpay payment whose order row never got created). COD has no
// Razorpay webhook to fall back on at all, so without a signal that's sent
// BEFORE the save is attempted, a failed COD order leaves no trace
// anywhere and the shop owner never finds out a customer tried to order.
// This route only sends an email -- no DB write, nothing that can itself
// silently fail in a way that blocks checkout -- so it should succeed
// even in the exact scenarios where the main save doesn't.
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req)
    if (originError) return originError
    const limitError = rateLimit(req, 'order-attempt', 6, 10 * 60 * 1000)
    if (limitError) return limitError
    const body = await req.json()
    const ref = cleanText(body.ref, 40)
    const customer_name = cleanText(body.customer_name, 100)
    const customer_phone = cleanText(body.customer_phone, 20)
    const customer_email = cleanText(body.customer_email, 254)
    const payment_method = cleanText(body.payment_method, 20)
    const grand_total = Number(body.grand_total)
    const subtotal = Number(body.subtotal)
    const items = Array.isArray(body.items) ? body.items.slice(0, 25) : []
    const shipping_address = cleanText(body.shipping_address, 500)
    const coupon_code = cleanText(body.coupon_code, 50)
    const coupon_label = cleanText(body.coupon_label, 100)
    if (!/^[A-Za-z0-9-]{3,40}$/.test(ref) || !/^\d{10}$/.test(customer_phone.replace(/^\+?91/, '')) || !Number.isFinite(grand_total) || grand_total < 1 || grand_total > 100000 || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'Invalid checkout attempt' }, { status: 400, headers })
    }
    if (ref) { try { await supabase.from('order_attempts').upsert({ ref, customer_name: customer_name || null, customer_phone: customer_phone || null, customer_email: customer_email || null, payment_method: payment_method || null, grand_total, subtotal: Number.isFinite(subtotal) ? subtotal : null, items, shipping_address: shipping_address || null, coupon_code: coupon_code || null, coupon_label: coupon_label || null }); } catch (e) {} }

    const rows = items.map(function(i: any){ var name=escapeHtml(cleanText(i.name||i.product_name, 120) || 'item'); var size=escapeHtml(cleanText(i.size||i.pack_label, 80)); var qty=Math.min(Math.max(Number(i.qty||i.quantity||1),1),99); var unitPrice=Number(i.unit_price??i.pack_price); var lineTotal=Number(i.line_total??(Number.isFinite(unitPrice)?unitPrice*qty:NaN)); return '<tr><td style=padding:6px 8px;border-bottom:1px solid #eee>'+name+'</td><td style=padding:6px 8px;border-bottom:1px solid #eee>'+(size||'-')+'</td><td style=padding:6px 8px;border-bottom:1px solid #eee;text-align:center>'+qty+'</td><td style=padding:6px 8px;border-bottom:1px solid #eee;text-align:right>'+(Number.isFinite(unitPrice)?('Rs '+unitPrice):'-')+'</td><td style=padding:6px 8px;border-bottom:1px solid #eee;text-align:right>'+(Number.isFinite(lineTotal)?('Rs '+lineTotal):'-')+'</td></tr>'; }).join(''); const itemsTable = rows ? ('<table style=width:100%;border-collapse:collapse;font-size:13px;margin-top:8px><thead><tr style=background:#f3f0ea><th style=padding:6px 8px;text-align:left>Item</th><th style=padding:6px 8px;text-align:left>Size</th><th style=padding:6px 8px;text-align:center>Qty</th><th style=padding:6px 8px;text-align:right>Unit Price</th><th style=padding:6px 8px;text-align:right>Line Total</th></tr></thead><tbody>'+rows+'</tbody></table>') : ''; const couponLine = coupon_code ? ('<p style=margin:8px 0><strong>Coupon used:</strong> '+escapeHtml(coupon_code)+(coupon_label?(' ('+escapeHtml(coupon_label)+')'):'')+'</p>') : '<p style=margin:8px 0;color:#6b7280><strong>Coupon used:</strong> none</p>'; const totalsLine = '<p style=margin:8px 0>'+(Number.isFinite(subtotal)?('<strong>Subtotal:</strong> Rs '+subtotal+' | '):'')+'<strong>Grand total:</strong> Rs '+grand_total+'</p>'; const addressLine = shipping_address ? ('<p style=margin:8px 0><strong>Shipping address:</strong> '+escapeHtml(shipping_address)+'</p>') : '';

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'helpgameofbones@gmail.com',
      subject: `\u23f3 Order attempt ${ref} - Rs ${grand_total} (${payment_method.toUpperCase()})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:20px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:24px"><div style="background:white;border-radius:12px;padding:20px"><h2 style="color:#1a1008;margin:0 0 12px">Checkout started</h2><p style="color:#6b7280;font-size:13px;margin:0 0 16px">Sent before an order is saved. Check the admin panel before following up.</p><p><strong>${escapeHtml(ref)}</strong></p><p>${escapeHtml(customer_name || 'Unknown')} - ${escapeHtml(customer_phone)} ${customer_email ? '- ' + escapeHtml(customer_email) : ''}</p><p>Payment method: ${escapeHtml(payment_method.toUpperCase())}</p>${itemsTable}${couponLine}${totalsLine}${addressLine}</div><a href="https://gameofbones-admin.vercel.app/orders" style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;margin-top:12px">Check Admin Panel</a></div></div>`
    })

    return NextResponse.json({ ok: true }, { headers })
  } catch (error: any) {
    // Never block or slow down checkout over this -- it's a best-effort
    // signal, not part of the critical path.
    return NextResponse.json({ ok: false, error: error.message }, { status: 200, headers })
  }
}
