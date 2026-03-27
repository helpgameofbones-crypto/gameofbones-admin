'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function InvoicesPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [generating, setGenerating] = useState<string | null>(null)

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

  async function generateInvoice(order: any) {
    setGenerating(order.id)

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    const gold   = [200, 151, 58] as [number, number, number]
    const dark   = [26, 16, 8]   as [number, number, number]
    const gray   = [107, 114, 128] as [number, number, number]
    const light  = [249, 246, 242] as [number, number, number]

    // Header background
    doc.setFillColor(...dark)
    doc.rect(0, 0, 210, 40, 'F')

    // Company name
    doc.setTextColor(...gold)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Game of Bones', 20, 20)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Real Food. Real Dogs. Real Results.', 20, 28)
    doc.text('gameofbones.in | +91 90825 03295', 20, 35)

    // Invoice label
    doc.setTextColor(...gold)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 160, 20)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(order.ref, 160, 28)
    doc.text(new Date(order.created_at).toLocaleDateString('en-IN'), 160, 35)

    // Bill to section
    doc.setFillColor(...light)
    doc.rect(0, 45, 210, 45, 'F')

    doc.setTextColor(...gray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO', 20, 55)

    doc.setTextColor(...dark)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(order.customer_name || '', 20, 63)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.text(order.customer_phone || '', 20, 70)
    doc.text(order.shipping_address?.line1 || '', 20, 77)
    doc.text(
      `${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} - ${order.shipping_address?.pincode || ''}`,
      20, 84
    )

    // Payment info
    doc.setTextColor(...gray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENT', 130, 55)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...dark)
    doc.text(order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid', 130, 63)
    doc.text(order.payment_status === 'paid' ? 'PAID' : 'PENDING', 130, 70)
    if (order.delhivery_awb) {
      doc.text('AWB: ' + order.delhivery_awb, 130, 77)
    }

    // Items table header
    doc.setFillColor(...dark)
    doc.rect(0, 96, 210, 10, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('ITEM', 20, 103)
    doc.text('SIZE', 100, 103)
    doc.text('QTY', 130, 103)
    doc.text('PRICE', 155, 103)
    doc.text('TOTAL', 178, 103)

    // Items
    let y = 115
    const items = order.items || []
    items.forEach((item: any, i: number) => {
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251)
        doc.rect(0, y - 5, 210, 10, 'F')
      }
      doc.setTextColor(...dark)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(item.name || '', 20, y)
      doc.text(item.sizeLabel || '', 100, y)
      doc.text(String(item.qty), 132, y)
      doc.text('Rs ' + (item.price || 0), 150, y)
      doc.text('Rs ' + ((item.price || 0) * (item.qty || 1)), 175, y)
      y += 12
    })

    // Totals
    y += 5
    doc.setDrawColor(...light)
    doc.line(120, y, 200, y)
    y += 8

    const totals = [
      { label: 'Subtotal', value: order.subtotal || 0 },
      ...(order.discount > 0 ? [{ label: `Discount (${order.coupon_code || ''})`, value: -order.discount }] : []),
      { label: 'Shipping', value: order.shipping || 0 },
    ]

    totals.forEach(row => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gray)
      doc.text(row.label, 120, y)
      doc.setTextColor(row.value < 0 ? 220 : dark[0], row.value < 0 ? 38 : dark[1], row.value < 0 ? 38 : dark[2])
      doc.text((row.value < 0 ? '-' : '') + 'Rs ' + Math.abs(row.value), 175, y)
      y += 8
    })

    // Grand total
    doc.setFillColor(...dark)
    doc.rect(115, y - 4, 90, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', 120, y + 4)
    doc.setTextColor(...gold)
    doc.text('Rs ' + order.grand_total, 162, y + 4)

    // Footer
    y += 30
    doc.setFillColor(...light)
    doc.rect(0, y, 210, 30, 'F')
    doc.setTextColor(...gray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Thank you for choosing Game of Bones!', 105, y + 8, { align: 'center' })
    doc.text('For any queries: helpgameofbones@gmail.com | +91 90825 03295', 105, y + 15, { align: 'center' })
    doc.text('gameofbones.in', 105, y + 22, { align: 'center' })

    doc.save(`Invoice-${order.ref}.pdf`)
    setGenerating(null)
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
          <span className="text-2xl">🐾</span>
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
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              Generate and download PDF invoices for any order
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
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No orders found</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c8973a' }}>
                    {order.ref}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                    ₹{order.grand_total?.toLocaleString('en-IN')}
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
                      disabled={generating === order.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                      style={{ background: '#c8973a' }}>
                      {generating === order.id ? 'Generating...' : '📄 Download PDF'}
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