import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  // Security check - only allow from Vercel cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Get today's orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())

  const orderList = orders || []
  const totalRevenue  = orderList.reduce((s, o) => s + (o.grand_total || 0), 0)
  const codOrders     = orderList.filter(o => o.payment_method === 'cod').length
  const prepaidOrders = orderList.filter(o => o.payment_method !== 'cod').length

  // Top products
  const productCounts: Record<string, number> = {}
  orderList.forEach(o => {
    (o.items || []).forEach((item: any) => {
      const key = item.name + (item.sizeLabel ? ` (${item.sizeLabel})` : '')
      productCounts[key] = (productCounts[key] || 0) + item.qty
    })
  })
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Get total customers
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  // New customers today
  const { count: newCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'helpgameofbones@gmail.com',
    subject: `📊 Daily Report — ${orderList.length} orders — ₹${totalRevenue.toLocaleString('en-IN')}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1008;padding:24px;text-align:center">
          <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
          <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:14px">Daily Report — ${dateStr}</p>
        </div>

        <div style="background:#f9f6f2;padding:24px">

          <!-- Revenue highlight -->
          <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;border-top:4px solid #c8973a">
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">TOTAL REVENUE TODAY</div>
            <div style="font-size:42px;font-weight:bold;color:#1a1008">₹${totalRevenue.toLocaleString('en-IN')}</div>
            <div style="font-size:14px;color:#6b7280;margin-top:4px">${orderList.length} orders placed</div>
          </div>

          <!-- Order breakdown -->
          <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
            <h3 style="color:#1a1008;margin:0 0 16px">Order Breakdown</h3>
            <table style="width:100%;font-size:14px">
              <tr>
                <td style="padding:8px 0;color:#6b7280">Total Orders</td>
                <td style="padding:8px 0;font-weight:bold;text-align:right">${orderList.length}</td>
              </tr>
              <tr style="background:#f9f6f2">
                <td style="padding:8px;color:#6b7280;border-radius:4px">COD Orders</td>
                <td style="padding:8px;font-weight:bold;text-align:right;color:#f59e0b">${codOrders}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">Prepaid Orders</td>
                <td style="padding:8px 0;font-weight:bold;text-align:right;color:#10b981">${prepaidOrders}</td>
              </tr>
              <tr style="background:#f9f6f2">
                <td style="padding:8px;color:#6b7280;border-radius:4px">New Customers</td>
                <td style="padding:8px;font-weight:bold;text-align:right;color:#3b82f6">${newCustomers || 0}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">Total Customers</td>
                <td style="padding:8px 0;font-weight:bold;text-align:right">${totalCustomers || 0}</td>
              </tr>
            </table>
          </div>

          <!-- Top products -->
          ${topProducts.length > 0 ? `
          <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
            <h3 style="color:#1a1008;margin:0 0 16px">Top Products Today</h3>
            ${topProducts.map(([name, qty], i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:24px;height:24px;border-radius:50%;background:#c8973a;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold">${i + 1}</div>
                  <span style="font-size:14px;color:#374151">${name}</span>
                </div>
                <span style="font-weight:bold;color:#1a1008">${qty} units</span>
              </div>
            `).join('')}
          </div>` : ''}

          <!-- Recent orders -->
          ${orderList.length > 0 ? `
          <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px">
            <h3 style="color:#1a1008;margin:0 0 16px">Today's Orders</h3>
            ${orderList.slice(0, 10).map(o => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
                <div>
                  <span style="font-weight:bold;color:#c8973a">${o.ref}</span>
                  <span style="color:#6b7280;margin-left:8px">${o.customer_name}</span>
                </div>
                <div>
                  <span style="font-weight:bold">₹${o.grand_total}</span>
                  <span style="margin-left:8px;padding:2px 6px;border-radius:10px;font-size:11px;background:${o.payment_method === 'cod' ? '#fef3c7' : '#dcfce7'};color:${o.payment_method === 'cod' ? '#92400e' : '#166534'}">${o.payment_method?.toUpperCase()}</span>
                </div>
              </div>
            `).join('')}
          </div>` : `
          <div style="background:white;border-radius:12px;padding:32px;text-align:center;margin-bottom:16px">
            <div style="font-size:32px;margin-bottom:8px">😴</div>
            <div style="color:#6b7280;font-size:14px">No orders today. Tomorrow will be better!</div>
          </div>`}

          <div style="text-align:center">
            <a href="https://gameofbones-admin.vercel.app/dashboard"
              style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">
              Open Admin Panel →
            </a>
          </div>
        </div>

        <div style="background:#1a1008;padding:16px;text-align:center">
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
            Game of Bones · This report is sent every day at 9 PM
          </p>
        </div>
      </div>
    `
  })

  return NextResponse.json({
    ok: true,
    orders: orderList.length,
    revenue: totalRevenue
  })
}