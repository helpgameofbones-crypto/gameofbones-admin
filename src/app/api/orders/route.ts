import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/app/lib/requireAdmin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin(req)
    if (authError) return authError

    const order = await req.json()
    const { type } = order

    if (type === 'dispatch') {
      if (order.customer_email) {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: order.customer_email,
          subject: `Your order ${order.ref} is on its way!`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:24px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:32px;text-align:center"><h2 style="color:#1a1008">Your order is on its way!</h2><p style="color:#6b7280">Hi ${order.customer_name}, your order <strong>${order.ref}</strong> has been dispatched.</p>${order.awb ? `<div style="background:white;border-radius:12px;padding:20px;margin:20px auto"><div style="font-size:12px;color:#6b7280;margin-bottom:6px">AWB Number</div><div style="font-size:24px;font-weight:bold;color:#1a1008;font-family:monospace">${order.awb}</div></div><a href="https://www.delhivery.com/track/package/${order.awb}" style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">Track Your Order</a>` : ''}</div></div>`
        })
      }
      return NextResponse.json({ ok: true, type: 'dispatch' })
    }

    if (type === 'delivery') {
      if (order.customer_email) {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: order.customer_email,
          subject: `Your order ${order.ref} has been delivered!`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:24px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:32px;text-align:center"><h2 style="color:#1a1008">Order Delivered!</h2><p style="color:#6b7280">Hi ${order.customer_name}, your order <strong>${order.ref}</strong> has been delivered!</p><div style="background:#fef3c7;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:0;color:#92400e;font-size:14px">Love the treats? Leave a review and get 10% off your next order!</p></div><a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">Leave a Review</a></div></div>`
        })
      }
      return NextResponse.json({ ok: true, type: 'delivery' })
    }

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'helpgameofbones@gmail.com',
      subject: `New Order ${order.ref} - Rs ${order.grand_total}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:20px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:24px"><div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px"><h2 style="color:#1a1008;margin:0 0 16px">New Order</h2><p><strong>${order.ref}</strong> - Rs ${order.grand_total}</p><p>${order.customer_name} - ${order.customer_phone}</p><p>${order.payment_method?.toUpperCase()}</p></div><a href="https://gameofbones-admin.vercel.app/orders" style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">View in Admin Panel</a></div></div>`
    })

    if (order.customer_email) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: order.customer_email,
        subject: `Order Confirmed - ${order.ref}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:24px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:24px;text-align:center"><h2 style="color:#1a1008">Order Confirmed!</h2><p style="color:#6b7280">Hi ${order.customer_name}, your order has been placed.</p><p style="font-size:20px;font-weight:bold;color:#c8973a">${order.ref}</p><p style="color:#6b7280">Payment: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</p><p style="color:#6b7280">Expected delivery: 4-7 business days</p></div></div>`
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
