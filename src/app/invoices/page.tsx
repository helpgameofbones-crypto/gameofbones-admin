'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function InvoicesPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders(data || [])
    setLoading(false)
  }

  function generateInvoice(order: any) {
    const items = (order.items || []).map((item: any) => `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:10px 16px">${item.name} (${item.sizeLabel || ''})</td>
        <td style="padding:10px 16px;text-align:center">${item.qty}</td>
        <td style="padding:10px 16px;text-align:right">Rs ${item.price}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:bold">Rs ${item.price * item.qty}</td>
      </tr>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${order.ref}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111827; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div style="max-width:700px;margin:0 auto;padding:0">

          <!-- Header -->
          <div style="background:#1a1008;padding:28px 32px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="color:#c8973a;font-size:24px;font-weight:bold"> Game of Bones</div>
              <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px">Real Food. Real Dogs. Real Results.</div>
              <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:2px">gameofbones.in | +91 90825 03295</div>
            </div>
            <div style="text-align:right">
              <div style="color:#c8973a;font-size:20px;font-weight:bold">INVOICE</div>
              <div style="color:white;font-size:14px;margin-top:4px">${order.ref}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:2px">${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <!-- Bill to / Payment -->
          <div style="background:#f9f6f2;padding:24px 32px;display:flex;justify-content:space-between">
            <div>
              <div style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#6b7280;text-transform:uppercase;margin-bottom:8px">Bill To</div>
              <div style="font-size:16px;font-weight:bold;color:#111827">${order.customer_name}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:3px">${order.customer_phone}</div>
              ${order.customer_email ? `<div style="font-size:13px;color:#6b7280">${order.customer_email}</div>` : ''}
              <div style="font-size:13px;color:#6b7280;margin-top:6px;line-height:1.6">
                ${order.shipping_address?.line1 || ''}<br>
                ${order.shipping_address?.line2 ? order.shipping_address.line2 + '<br>' : ''}
                ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} - ${order.shipping_address?.pincode || ''}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#6b7280;text-transform:uppercase;margin-bottom:8px">Payment</div>
              <div style="font-size:14px;color:#111827">${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</div>
              <div style="font-size:13px;margin-top:3px;font-weight:bold;color:${order.payment_status === 'paid' ? '#10b981' : '#f59e0b'}">${(order.payment_status || 'pending').toUpperCase()}</div>
              ${order.delhivery_awb ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">AWB: ${order.delhivery_awb}</div>` : ''}
            </div>
          </div>

          <!-- Items table -->
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#1a1008">
                <th style="padding:12px 16px;text-align:left;color:white;font-size:12px;letter-spacing:.05em">ITEM</th>
                <th style="padding:12px 16px;text-align:center;color:white;font-size:12px;letter-spacing:.05em">QTY</th>
                <th style="padding:12px 16px;text-align:right;color:white;font-size:12px;letter-spacing:.05em">PRICE</th>
                <th style="padding:12px 16px;text-align:right;color:white;font-size:12px;letter-spacing:.05em">TOTAL</th>
              </tr>
            </thead>
            <tbody>${items}</tbody>
          </table>

          <!-- Totals -->
          <div style="display:flex;justify-content:flex-end;padding:16px 32px;background:#f9f6f2">
            <div style="min-width:260px">
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:#6b7280">Subtotal</span>
                <span>Rs ${order.subtotal}</span>
              </div>
              ${order.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:#6b7280">Discount ${order.coupon_code ? '(' + order.coupon_code + ')' : ''}</span>
                <span style="color:#10b981">-Rs ${order.discount}</span>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:#6b7280">Shipping</span>
                <span>${order.shipping === 0 ? 'FREE' : 'Rs ' + order.shipping}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:12px 16px;background:#1a1008;margin-top:8px;border-radius:6px">
                <span style="color:white;font-weight:bold;font-size:16px">TOTAL</span>
                <span style="color:#c8973a;font-weight:bold;font-size:18px">Rs ${order.grand_total}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#1a1008;padding:20px 32px;text-align:center;margin-top:8px">
            <div style="color:#c8973a;font-weight:bold;margin-bottom:6px">Thank you for choosing Game of Bones! </div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px">helpgameofbones@gmail.com | +91 90825 03295 | gameofbones.in</div>
          </div>

        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Invoices',  href: '/invoices' },
    { label: 'Customers', href: '/customers' },
    { label: 'Analytics', href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Invoices</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Generate and print PDF invoices for any order
            </p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order or customer..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Order Ref','Customer','Date','Total','Payment','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No orders found</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c8973a' }}>
                    {order.ref}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                    Rs {order.grand_total?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7',
                        color: order.payment_method === 'cod' ? '#92400e' : '#166534'
                      }}>
                      {order.payment_method?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => generateInvoice(order)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                      style={{ background: '#c8973a' }}>
                       Print Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
