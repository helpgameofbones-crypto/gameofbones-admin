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

  const twentyDaysAgo = new Date()
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)

  const fortyDaysAgo = new Date()
  fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .gt('total_orders', 0)
    .not('customer_email', 'is', null)

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('customer_phone, created_at, items')
    .gte('created_at', fortyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  const lastOrderMap: Record<string, any> = {}
  ;(recentOrders || []).forEach(o => {
    if (!lastOrderMap[o.customer_phone]) {
      lastOrderMap[o.customer_phone] = o
    }
  })

  const toRemind = (customers || []).filter(c => {
    const lastOrder = lastOrderMap[c.phone]
    if (!lastOrder) return false
    const lastDate = new Date(lastOrder.created_at)
    return lastDate < twentyDaysAgo && lastDate > fortyDaysAgo
  })

  let sent = 0

  for (const customer of toRemind) {
    if (!customer.email) continue

    const lastOrder = lastOrderMap[customer.phone]
    const lastItems = (lastOrder?.items || [])
      .slice(0, 3)
      .map((i: any) => i.name)
      .join(', ')

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: customer.email,
      subject: `Your pup is waiting for their treats! 🐾`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1008;padding:24px;text-align:center">
            <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
          </div>

          <div style="background:#f9f6f2;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:48px;margin-bottom:12px">🦴</div>
              <h2 style="color:#1a1008;margin:0 0 8px">
                Hi ${customer.name}! Time for a restock?
              </h2>
              <p style="color:#6b7280;font-size:14px;margin:0">
                It's been a while since your last order. Your pup must be running low on treats!
              </p>
            </div>

            ${lastItems ? `
            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:20px">
              <div style="font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:8px">
                Last ordered
              </div>
              <div style="font-size:15px;color:#111827;font-weight:600">${lastItems}</div>
              <div style="font-size:12px;color:#9ca3af;margin-top:4px">
                ${new Date(lastOrder.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
              </div>
            </div>` : ''}

            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #c8973a">
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6">
                Single-ingredient, preservative-free treats — exactly what your dog deserves.
                Fresh stock ready to ship! 🚀
              </p>
            </div>

            <div style="text-align:center">
              <a href="https://gameofbones.in"
                style="background:#c8973a;color:#1a1008;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;margin-bottom:12px">
                Reorder Now →
              </a>
              <p style="font-size:12px;color:#9ca3af;margin:8px 0 0">
                Free shipping on orders above ₹599
              </p>
            </div>
          </div>

          <div style="background:#1a1008;padding:16px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
              Game of Bones · gameofbones.in · You're receiving this because you ordered from us
            </p>
          </div>
        </div>
      `
    })
    sent++
  }

  retur
