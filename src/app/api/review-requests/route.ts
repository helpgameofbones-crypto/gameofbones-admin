import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const fourDaysAgo = new Date()
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)

  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'delivered')
    .gte('updated_at', fourDaysAgo.toISOString())
    .lte('updated_at', threeDaysAgo.toISOString())

  let sent = 0

  for (const order of (deliveredOrders || [])) {
    if (!order.customer_email) continue

    const items = (order.items || [])
      .slice(0, 2)
      .map((i: any) => i.name)
      .join(' and ')

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: order.customer_email,
      subject: `How did ${items} go down? 🐾`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1008;padding:24px;text-align:center">
            <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
          </div>

          <div style="background:#f9f6f2;padding:32px;text-align:center">
            <div style="font-size:48px;margin-bottom:16px">⭐</div>
            <h2 style="color:#1a1008;margin:0 0 8px">
              How did your pup like the treats?
            </h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 8px">
              Hi ${order.customer_name}!
            </p>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
              Your order <strong>${order.ref}</strong> was delivered 3 days ago.
              We'd love to know what your dog thought! 🐶
            </p>

            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px">
              <div style="font-size:13px;color:#6b7280;margin-bottom:12px">
                Tap a star to rate your experience
              </div>
              <div style="font-size:40px;letter-spacing:8px;margin-bottom:16px">
                ⭐⭐⭐⭐⭐
              </div>
              <a href="https://gameofbones.in"
                style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">
                Leave a Review →
              </a>
            </div>

            <div style="background:#fef3c7;border-radius:12px;padding:16px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#92400e">
                🎁 <strong>Leave a review and get 10% off</strong> your next order!
                We'll send you a code once your review is live.
              </p>
            </div>

            <p style="color:#9ca3af;font-size:12px">
              Questions? WhatsApp us at +91 90825 03295
            </p>
          </div>

          <div style="background:#1a1008;padding:16px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
              Game of Bones · gameofbones.in
            </p>
          </div>
        </div>
      `
    })
    sent++
  }

  retur
