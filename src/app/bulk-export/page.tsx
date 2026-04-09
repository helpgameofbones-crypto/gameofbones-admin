'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function BulkExportPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('today')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    const from = new Date()
    if (filter === 'today') from.setHours(0,0,0,0)
    else if (filter === 'week') from.setDate(from.getDate() - 7)
    else if (filter === 'month') from.setDate(from.getDate() - 30)

    const { data } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from.toISOString())
      .not('status', 'in', '("delivered","rto","cancelled")')
      .order('created_at', { ascending: false })

    setOrders(data || [])
    setSelected(new Set())
    setLoading(false)
  }

  function toggleSelect(id: string) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  function selectAll() {
    if (selected.size === orders.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orders.map(o => o.id)))
    }
  }

  function exportCSV() {
    const toExport = orders.filter(o => selected.has(o.id))
    const rows = [
      ['Order Ref', 'Date', 'Customer Name', 'Phone', 'Email',
       'Address', 'City', 'State', 'Pincode', 'Items',
       'Total', 'Payment', 'Status', 'AWB'],
      ...toExport.map(o => [
        o.ref,
        new Date(o.created_at).toLocaleDateString('en-IN'),
        o.customer_name,
        o.customer_phone,
        o.customer_email || '',
        o.shipping_address?.line1 || '',
        o.shipping_address?.city || '',
        o.shipping_address?.state || '',
        o.shipping_address?.pincode || '',
        (o.items || []).map((i: any) => `${i.qty}x ${i.name}`).join(' | '),
        o.grand_total,
        o.payment_method?.toUpperCase(),
        o.status,
        o.delhivery_awb || ''
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function exportDelhivery() {
    const toExport = orders.filter(o => selected.has(o.id))
    const rows = [
      ['Consignee', 'Mobile', 'Address', 'City', 'State', 'Pincode',
       'Product', 'Weight', 'COD Amount', 'Order Ref'],
      ...toExport.map(o => {
        const weight = (o.items || []).reduce((s: number, i: any) => s + ((i.weight_grams || 100) * i.qty), 0) / 1000
        return [
          o.customer_name,
          o.customer_phone,
          o.shipping_address?.line1 + (o.shipping_address?.line2 ? ', ' + o.shipping_address?.line2 : ''),
          o.shipping_address?.city || '',
          o.shipping_address?.state || '',
          o.shipping_address?.pincode || '',
          (o.items || []).map((i: any) => `${i.qty}x ${i.name}`).join(' | '),
          weight.toFixed(2),
          o.payment_method === 'cod' ? o.grand_total : 0,
          o.ref
        ]
      })
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `delhivery-import-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const navLinks = [
    { label: 'Dashboard',    href: '/dashboard' },
    { label: 'Orders',       href: '/orders' },
    { label: 'Products',     href: '/products' },
    { label: 'Customers',    href: '/customers' },
    { label: 'Bulk Export',  href: '/bulk-export' },
    { label: 'Analytics',    href: '/analytics' },
    { label: 'Inventory',    href: '/inventory' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
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

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Bulk Export</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              Select orders and export to CSV or Delhivery format
            </p>
          </div>
          <div className="flex gap-3">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              style={{ color: '#111827' }}>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
            {selected.size > 0 && (
              <>
                <button onClick={exportCSV}
                  className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: '#3b82f6' }}>
                  Export {selected.size} Orders (CSV)
                </button>
                <button onClick={exportDelhivery}
                  className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: '#10b981' }}>
                  Export for Delhivery
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selected.size === orders.length && orders.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                {['Order Ref','Customer','Items','Total','Payment','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No orders found</td></tr>
              ) : orders.map(order => (
                <tr key={order.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleSelect(order.id)}
                  style={{ background: selected.has(order.id) ? '#f0fdf4' : 'white' }}>
                  <td className="px-4 py-3">
                    <input type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c8973a' }}>
                    {order.ref}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {(order.items || []).slice(0, 2).map((item: any, i: number) => (
                      <div key={i} className="text-xs" style={{ color: '#6b7280' }}>
                        {item.qty}Ã— {item.name}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                    â‚¹{order.grand_total?.toLocaleString('en-IN')}
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
                    <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                      style={{ background: '#f3f4f6', color: '#374151' }}>
                      {order.status?.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected.size > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm" style={{ color: '#1e40af' }}>
              <strong>{selected.size} orders selected.</strong> Click
              "Export Orders (CSV)" for a general export or
              "Export for Delhivery" to get a CSV formatted for Delhivery bulk upload.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}