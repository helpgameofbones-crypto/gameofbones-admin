'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUSES = ['placed','confirmed','packed','labelled','pickup_ready','dispatched','delivered','rto']

const STATUS_COLORS: Record<string, string> = {
  placed:       'bg-yellow-100 text-yellow-800',
  confirmed:    'bg-blue-100 text-blue-800',
  packed:       'bg-purple-100 text-purple-800',
  labelled:     'bg-indigo-100 text-indigo-800',
  pickup_ready: 'bg-orange-100 text-orange-800',
  dispatched:   'bg-cyan-100 text-cyan-800',
  delivered:    'bg-green-100 text-green-800',
  rto:          'bg-red-100 text-red-800',
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    await supabase.from('order_status_log').insert({ order_id: orderId, status: newStatus })
    fetchOrders()
    if (selected?.id === orderId) setSelected({ ...selected, status: newStatus })
  }

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  )

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs text-white/50">Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1">
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Orders',    href: '/orders' },
            { label: 'Products',  href: '/products' },
            { label: 'Customers', href: '/customers' },
            { label: 'Coupons',   href: '/coupons' },
            { label: 'Banners',   href: '/banners' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1a1008' }}>Orders</h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ref, name, phone..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none bg-white"
          />
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filter === s
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={filter === s ? { background: '#1a1008' } : {}}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Order Ref', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No orders found</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: '#c8973a' }}>
                    {order.ref}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{order.customer_name}</div>
                    <div className="text-xs text-gray-400">{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {(order.items || []).slice(0, 2).map((item: any, i: number) => (
                      <div key={i} className="text-xs text-gray-600">{item.qty}× {item.name}</div>
                    ))}
                    {(order.items || []).length > 2 && (
                      <div className="text-xs text-gray-400">+{order.items.length - 2} more</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800">
                    ₹{order.grand_total?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      order.payment_method === 'cod'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {order.payment_method?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                      STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {order.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {STATUSES.indexOf(order.status) < STATUSES.length - 1 && (
                        <button
                          onClick={() => updateStatus(order.id, STATUSES[STATUSES.indexOf(order.status) + 1])}
                          className="text-white text-xs px-2 py-1 rounded font-medium"
                          style={{ background: '#1a1008' }}>
                          → {STATUSES[STATUSES.indexOf(order.status) + 1]?.replace('_', ' ')}
                        </button>
                      )}
                      <button
                        onClick={() => setSelected(order)}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-mono font-bold text-lg" style={{ color: '#c8973a' }}>
                  {selected.ref}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {new Date(selected.created_at).toLocaleString('en-IN')}
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</div>
                <div className="font-medium">{selected.customer_name}</div>
                <div className="text-sm text-gray-500">{selected.customer_phone}</div>
                <div className="text-sm text-gray-500">{selected.customer_email}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Delivery Address</div>
                <div className="text-sm text-gray-700">
                  {selected.shipping_address?.line1}<br />
                  {selected.shipping_address?.line2 && <>{selected.shipping_address.line2}<br /></>}
                  {selected.shipping_address?.city}, {selected.shipping_address?.state} — {selected.shipping_address?.pincode}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</div>
                {(selected.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span>{item.qty}× {item.name} ({item.sizeLabel})</span>
                    <span className="font-medium">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 font-bold">
                  <span>Total</span>
                  <span>₹{selected.grand_total?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</div>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
                        selected.status === s
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={selected.status === s ? { background: '#1a1008' } : {}}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {selected.delhivery_awb && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Tracking</div>
                  <div className="font-mono text-sm bg-gray-50 px-3 py-2 rounded">
                    AWB: {selected.delhivery_awb}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}