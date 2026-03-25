import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const order = await req.json()

    // Email to YOU — order notification
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'helpgameofbones@gmail.com',
      subject: `🐾 New Order ${order.ref} — ₹${order.grand_total}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1008;padding:20px;text-align:center">
            <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            <p style="color:rgba(255,255,255,0.6);margin:4px 0 0">New Order Received</p>
          </div>

          <div style="background:#f9f6f2;padding:24px">
            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
              <h2 style="color:#1a1008;margin:0 0 16px">Order Details</h2>
              <table style="width:100%;font-size:14px">
                <tr>
                  <td style="padding:6px 0;color:#666">Order Ref</td>
                  <td style="padding:6px 0;font-weight:bold;color:#c8973a">${order.ref}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#666">Total</td>
                  <td style="padding:6px 0;font-weight:bold">₹${order.grand_total}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#666">Payment</td>
                  <td style="padding:6px 0">
                    <span style="background:${order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7'};
                      color:${order.payment_method === 'cod' ? '#92400e' : '#166534'};
                      padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">
                      ${order.payment_method?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
              <h3 style="color:#1a1008;margin:0 0 12px">Customer</h3>
              <p style="margin:4px 0;font-size:14px"><strong>${order.customer_name}</strong></p>
              <p style="margin:4px 0;font-size:14px;color:#666">${order.customer_phone}</p>
              <p style="margin:4px 0;font-size:14px;color:#666">${order.customer_email || ''}</p>
            </div>

            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
              <h3 style="color:#1a1008;margin:0 0 12px">Delivery Address</h3>
              <p style="margin:4px 0;font-size:14px;color:#444">
                ${order.shipping_address?.line1 || ''}<br/>
                ${order.shipping_address?.line2 ? order.shipping_address.line2 + '<br/>' : ''}
                ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} — ${order.shipping_address?.pincode || ''}
              </p>
            </div>

            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
              <h3 style="color:#1a1008;margin:0 0 12px">Items Ordered</h3>
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                ${(order.items || []).map((item: any) => `
                  <tr style="border-bottom:1px solid #f3f4f6">
                    <td style="padding:8px 0">${item.name} (${item.sizeLabel})</td>
                    <td style="padding:8px 0;text-align:center;color:#666">${item.qty}x</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600">₹${item.price * item.qty}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td colspan="2" style="padding:12px 0 4px;font-weight:bold">Subtotal</td>
                  <td style="padding:12px 0 4px;text-align:right;font-weight:bold">₹${order.subtotal}</td>
                </tr>
                ${order.discount > 0 ? `
                <tr>
                  <td colspan="2" style="padding:4px 0;color:#16a34a">Discount (${order.coupon_code})</td>
                  <td style="padding:4px 0;text-align:right;color:#16a34a">-₹${order.discount}</td>
                </tr>` : ''}
                <tr>
                  <td colspan="2" style="padding:4px 0;color:#666">Shipping</td>
                  <td style="padding:4px 0;text-align:right;color:#666">${order.shipping === 0 ? 'FREE' : '₹' + order.shipping}</td>
                </tr>
                <tr style="border-top:2px solid #1a1008">
                  <td colspan="2" style="padding:12px 0 0;font-size:16px;font-weight:bold">Total</td>
                  <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:bold">₹${order.grand_total}</td>
                </tr>
              </table>
            </div>

            <div style="text-align:center">
              <a href="https://gameofbones-admin.vercel.app/orders"
                style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">
                View in Admin Panel →
              </a>
            </div>
          </div>

          <div style="background:#1a1008;padding:16px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
              Game of Bones · gameofbones.in
            </p>
          </div>
        </div>
      `
    })

    // Email to CUSTOMER — order confirmation
    if (order.customer_email) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: order.customer_email,
        subject: `Order Confirmed 🐾 — ${order.ref}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a1008;padding:24px;text-align:center">
              <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            </div>

            <div style="background:#f9f6f2;padding:24px">
              <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center">
                <div style="font-size:48px;margin-bottom:12px">🎉</div>
                <h2 style="color:#1a1008;margin:0 0 8px">Order Confirmed!</h2>
                <p style="color:#666;margin:0">Hi ${order.customer_name}, your order has been placed successfully.</p>
                <div style="background:#f9f6f2;border-radius:8px;padding:12px;margin-top:16px;display:inline-block">
                  <span style="font-size:12px;color:#666">Order Reference</span><br/>
                  <span style="font-size:20px;font-weight:bold;color:#c8973a">${order.ref}</span>
                </div>
              </div>

              <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
                <h3 style="color:#1a1008;margin:0 0 12px">Your Items</h3>
                <table style="width:100%;font-size:14px;border-collapse:collapse">
                  ${(order.items || []).map((item: any) => `
                    <tr style="border-bottom:1px solid #f3f4f6">
                      <td style="padding:8px 0">${item.name} (${item.sizeLabel})</td>
                      <td style="padding:8px 0;text-align:center;color:#666">${item.qty}x</td>
                      <td style="padding:8px 0;text-align:right;font-weight:600">₹${item.price * item.qty}</td>
                    </tr>
                  `).join('')}
                  <tr>
                    <td colspan="2" style="padding:12px 0 0;font-weight:bold;font-size:16px">Total</td>
                    <td style="padding:12px 0 0;text-align:right;font-weight:bold;font-size:16px">₹${order.grand_total}</td>
                  </tr>
                </table>
              </div>

              <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
                <h3 style="color:#1a1008;margin:0 0 12px">Delivery Address</h3>
                <p style="margin:0;font-size:14px;color:#444;line-height:1.6">
                  ${order.shipping_address?.line1 || ''}<br/>
                  ${order.shipping_address?.line2 ? order.shipping_address.line2 + '<br/>' : ''}
                  ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} — ${order.shipping_address?.pincode || ''}
                </p>
              </div>

              <div style="background:#fef3c7;border-radius:12px;padding:20px;margin-bottom:16px">
                <p style="margin:0;font-size:14px;color:#92400e">
                  <strong>Expected Delivery:</strong> 4–7 business days<br/>
                  <strong>Payment:</strong> ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid — Already Paid'}<br/>
                  <strong>Questions?</strong> WhatsApp us at +91 90825 03295
                </p>
              </div>
            </div>

            <div style="background:#1a1008;padding:16px;text-align:center">
              <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
                Game of Bones · Kalyan, Maharashtra · gameofbones.in
              </p>
            </div>
          </div>
        `
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}