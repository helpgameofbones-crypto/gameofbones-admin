import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/app/lib/emailClient'
import { corsHeaders } from '@/app/lib/cors'

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
    const body = await req.json()
    const { ref, customer_name, customer_phone, customer_email, payment_method, grand_total, items } = body

    const itemsList = Array.isArray(items)
      ? items.map((i: any) => `${i.name || i.product_name || 'item'} x${i.qty || i.quantity || 1}`).join(', ')
      : ''

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'helpgameofbones@gmail.com',
      subject: `\u23f3 Order attempt ${ref || ''} - Rs ${grand_total || '?'} (${(payment_method || '').toUpperCase()})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:20px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:24px"><div style="background:white;border-radius:12px;padding:20px"><h2 style="color:#1a1008;margin:0 0 12px">Checkout started</h2><p style="color:#6b7280;font-size:13px;margin:0 0 16px">Sent the moment checkout began, before the order was necessarily saved. If you don't see this order in the admin panel within a few minutes, the save may have failed and needs manual follow-up.</p><p><strong>${ref || '(no ref yet)'}</strong> - Rs ${grand_total || '?'}</p><p>${customer_name || 'Unknown'} - ${customer_phone || 'no phone'} ${customer_email ? '- ' + customer_email : ''}</p><p>${(payment_method || 'unknown').toUpperCase()}</p>${itemsList ? '<p>' + itemsList + '</p>' : ''}</div><a href="https://gameofbones-admin.vercel.app/orders" style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;margin-top:12px">Check Admin Panel</a></div></div>`
    })

    return NextResponse.json({ ok: true }, { headers })
  } catch (error: any) {
    // Never block or slow down checkout over this -- it's a best-effort
    // signal, not part of the critical path.
    return NextResponse.json({ ok: false, error: error.message }, { status: 200, headers })
  }
}
