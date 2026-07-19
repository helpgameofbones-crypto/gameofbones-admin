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

// Same XOR/base64 scheme as the website's encryptData() — customer_phone is stored encrypted.
// TODO(security): this is a reversible XOR+base64 obfuscation, not real encryption, and the
// key is hardcoded and shipped to client bundles — it provides no real protection. Replace with
// server-side AES-256-GCM (key from a secrets manager, never sent to the browser) and run a
// data migration for existing rows. Not safe to change here without DB access to migrate data.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'
function decryptData(encrypted: string): string {
  if (!encrypted) return ''
  try {
    const binary = Buffer.from(encrypted, 'base64').toString('binary')
    let result = ''
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return encrypted
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return ''
  if (/^\+?\d{10,13}$/.test(raw)) return raw
  const dec = decryptData(raw)
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch yesterday's orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', yesterday.toISOString())
    .lt('created_at', today.toISOString())
    .neq('status', 'cancelled')

  const totalOrders = orders?.length || 0
  const totalRevenue = orders?.reduce((s, o) => s + (o.grand_total || 0), 0) || 0
  const codOrders = orders?.filter(o => o.payment_method === 'cod').length || 0
  const prepaidOrders = orders?.filter(o => o.payment_method !== 'cod').length || 0
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  // Product breakdown
  // Order items are saved with `product_name`/`quantity` keys, not `name`/`qty`.
  const productCount: Record<string, number> = {}
  orders?.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : []
    items.forEach((item: any) => {
      const name = item.name ?? item.product_name ?? 'Unknown'
      const qty = item.qty ?? item.quantity ?? 1
      productCount[name] = (productCount[name] || 0) + qty
    })
  })
  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Fetch last 7 days for comparison
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { data: weekOrders } = await supabase
    .from('orders')
    .select('grand_total')
    .gte('created_at', weekAgo.toISOString())
    .neq('status', 'cancelled')
  const weekRevenue = weekOrders?.reduce((s, o) => s + (o.grand_total || 0), 0) || 0
  const dailyAvg7 = Math.round(weekRevenue / 7)

  const dateStr = yesterday.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f6f2;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#1a1008;padding:20px 28px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:18px;font-weight:700;color:#c8973a">Game of Bones</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">Daily Sales Report</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:rgba(255,255,255,.7)">${dateStr}</div>
    </div>
  </div>

  <div style="background:white;padding:24px 28px">
    <!-- Key numbers -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div style="text-align:center;padding:16px;background:#f9f6f2;border-radius:8px">
        <div style="font-size:28px;font-weight:800;color:#1a1008">${totalOrders}</div>
        <div style="font-size:11px;color:#8a7a6a;margin-top:4px;text-transform:uppercase;letter-spacing:.08em">Orders</div>
      </div>
      <div style="text-align:center;padding:16px;background:#f9f6f2;border-radius:8px">
        <div style="font-size:28px;font-weight:800;color:#c8973a">Rs.${totalRevenue.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:#8a7a6a;margin-top:4px;text-transform:uppercase;letter-spacing:.08em">Revenue</div>
      </div>
      <div style="text-align:center;padding:16px;background:#f9f6f2;border-radius:8px">
        <div style="font-size:28px;font-weight:800;color:#1a1008">Rs.${avgOrderValue.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:#8a7a6a;margin-top:4px;text-transform:uppercase;letter-spacing:.08em">Avg Order</div>
      </div>
    </div>

    <!-- Payment split -->
    <div style="margin-bottom:20px;padding:14px 16px;background:#f9f6f2;border-radius:8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a7a6a;margin-bottom:10px">Payment Split</div>
      <div style="display:flex;gap:16px">
        <div style="font-size:14px;color:#1a1008">COD: <strong>${codOrders}</strong></div>
        <div style="font-size:14px;color:#1a1008">Prepaid: <strong>${prepaidOrders}</strong></div>
        <div style="font-size:14px;color:#${dailyAvg7 > 0 ? (totalRevenue >= dailyAvg7 ? '16a34a' : 'dc2626') : '8a7a6a'}">
          vs 7-day avg: <strong>Rs.${dailyAvg7.toLocaleString('en-IN')}</strong>
          ${totalRevenue >= dailyAvg7 ? ' ↑' : ' ↓'}
        </div>
      </div>
    </div>

    <!-- Top products -->
    ${topProducts.length > 0 ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a7a6a;margin-bottom:10px">Top Products</div>
      ${topProducts.map(([name, qty]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:13px">
          <span style="color:#1a1008">${name}</span>
          <span style="font-weight:700;color:#c8973a">${qty} units</span>
        </div>`).join('')}
    </div>` : '<div style="color:#8a7a6a;font-size:14px;text-align:center;padding:20px">No orders yesterday</div>'}

    <!-- Orders list -->
    ${totalOrders > 0 ? `
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a7a6a;margin-bottom:10px">Order Details</div>
      ${orders?.map(o => `
        <div style="padding:10px 0;border-bottom:1px solid #f0ebe3;font-size:12px">
          <div style="display:flex;justify-content:space-between">
            <span style="font-weight:700;color:#c8973a">${o.ref}</span>
            <span style="font-weight:700;color:#1a1008">Rs.${o.grand_total?.toLocaleString('en-IN')}</span>
          </div>
          <div style="color:#8a7a6a;margin-top:2px">${o.customer_name} · ${decryptPhone(o.customer_phone)} · ${o.payment_method?.toUpperCase()}</div>
        </div>`).join('') || ''}
    </div>` : ''}
  </div>

  <div style="background:#1a1008;padding:16px 28px;border-radius:0 0 8px 8px;text-align:center">
    <a href="https://gameofbones-admin.vercel.app/orders" style="font-size:12px;color:#c8973a;text-decoration:none">View All Orders →</a>
  </div>
</div>
</body></html>`

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: 'helpgameofbones@gmail.com',
    subject: `Daily Sales: Rs.${totalRevenue.toLocaleString('en-IN')} · ${totalOrders} orders · ${dateStr}`,
    html,
