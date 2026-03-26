'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getRTORisk(order: any) {
  let score = 0
  if (order.payment_method === 'cod') score += 30
  if (order.payment_method === 'cod' && order.grand_total > 1000) score += 20
  const highRTOStates = ['Manipur','Nagaland','Mizoram','Arunachal Pradesh','Meghalaya','Tripura','Sikkim']
  if (highRTOStates.includes(order.shipping_address?.state)) score += 25
  if (!order.shipping_address?.line2) score += 10
  if (!order.customer_email) score += 10
  if (score >= 60) return { level: 'High', color: '#ef4444', bg: '#fef2f2', score }
  if (score >= 30) return { level: 'Medium', color: '#f59e0b', bg: '#fefce8', score }
  return { level: 'Low', color: '#10b981', bg: '#f0fdf4', score }
}

export default function RTOPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', '("delivered","rto")')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const withRisk = orders.map(o => ({ ...o, risk: getRTORisk(o) }))
  const filtered = filter === 'all' ? withRisk
    : withRisk.filter(o => o.risk.level.toLowerCase() === filter)

  const highCount   = withRisk.filter(o => o.risk.level === 'High').length
  const medCount    = withRisk.filter(o => o.risk.level === 'Medium').length
  const lowCount    = withRisk.filter(o => o.risk.level === 'Low').length

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Coupons',   href: '/coupons' },
    { label: 'Banners',   href: '/banners' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'RTO Risk',  href: '/rto' },
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

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>RTO Risk Prediction</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Orders flagged as high risk for Return to Origin
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'High Risk Orders',   value: highCount, color: '#ef4444', bg: '#fef2f2', icon: '🔴' },
            { label: 'Medium Risk Orders', value: medCount,  color: '#f59e0b', bg: '#fefce8', icon: '🟡' },
            { label: 'Low Risk Orders',    value: lowCount,  color: '#10b981', bg: '#f0fdf4', icon: '🟢' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {['all', 'high', 'medium', 'low'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
              style={{
                background: filter === f ? '#1a1008' : 'white',
                color: filter === f ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {f === 'all' ? 'All Orders' : f + ' Risk'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Order', 'Customer', 'Total', 'Payment', 'State', 'Risk Score', 'Risk Level', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No orders found</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50"
                  style={{ background: order.risk.level === 'High' ? '#fff5f5' : 'white' }}>
                  <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: '#c8973a' }}>
                    {order.ref}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{order.customer_phone}</div>
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
                  <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>
                    {order.shipping_address?.state || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold" style={{ color: order.risk.color }}>
                      {order.risk.score}/100
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: order.risk.bg, color: order.risk.color }}>
                      {order.risk.level} Risk
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${order.customer_phone}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                      style={{ background: order.risk.level === 'High' ? '#ef4444' : '#6b7280' }}>
                      📞 Call
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold mb-3" style={{ color: '#111827' }}>How Risk is Calculated</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { factor: 'COD Payment',            points: '+30', color: '#ef4444' },
              { factor: 'COD order above ₹1000',  points: '+20', color: '#ef4444' },
              { factor: 'Northeast state',         points: '+25', color: '#f59e0b' },
              { factor: 'Incomplete address',      points: '+10', color: '#f59e0b' },
              { factor: 'No email provided',       points: '+10', color: '#f59e0b' },
              { factor: 'Prepaid payment',         points: '+0',  color: '#10b981' },
            ].map(item => (
              <div key={item.factor} className="flex justify-between items-center p-3 rounded-lg"
                style={{ background: '#f9fafb' }}>
                <span style={{ color: '#374151' }}>{item.factor}</span>
                <span className="font-bold" style={{ color: item.color }}>{item.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}