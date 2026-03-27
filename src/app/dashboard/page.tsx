'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [stats, setStats]   = useState({ orders: 0, revenue: 0, customers: 0, pending: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    const { count: customers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    const all       = orders || []
    const todayOrds = all.filter(o => new Date(o.created_at) >= today)
    const revenue   = todayOrds.reduce((s, o) => s + (o.grand_total || 0), 0)
    const pending   = all.filter(o => ['placed','confirmed','packed','labelled','pickup_ready'].includes(o.status)).length

    setStats({ orders: todayOrds.length, revenue, customers: customers || 0, pending })
    setRecent(all.slice(0, 10))
    setLoading(false)
  }

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'Orders',      href: '/orders' },
    { label: 'Products',    href: '/products' },
    { label: 'Customers',   href: '/customers' },
    { label: 'Coupons',     href: '/coupons' },
    { label: 'Banners',     href: '/banners' },
    { label: 'Analytics',   href: '/analytics' },
    { label: 'Inventory',   href: '/inventory' },
    { label: 'RTO Risk',    href: '/rto' },
    { label: 'Campaigns',   href: '/campaigns' },
    { label: 'Tasks',       href: '/tasks' },
    { label: 'Invoices',    href: '/invoices' },
    { label: 'Bulk Export', href: '/bulk-export' },
    { label: 'Activity',    href: '/activity' },
  ]

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    placed:       { bg: '#fef3c7', color: '#92400e' },
    confirmed:    { bg: '#dbeafe', color: '#1e40af' },
    packed:       { bg: '#ede9fe', color: '#5b21b6' },
    labelled:     { bg: '#e0e7ff', color: '#3730a3' },
    pickup_ready: { bg: '#ffedd5', color: '#9a3412' },
    dispatched:   { bg: '#cffafe', color: '#155e75' },
    delivered:    { bg: '#dcfce7', color: '#166534' },
    rto:          { bg: '#fef2f2', color: '#ef4444' },
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      {/* Nav */}
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap justify-end">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#111827' }}>Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's Orders",  value: stats.orders,                                icon: '📦', color: '#3b82f6' },
            { label: 'Total Revenue',   value: '₹' + stats.revenue.toLocaleString('en-IN'), icon: '💰', color: '#10b981' },
            { label: 'Total Customers', value: stats.customers,                             icon: '👥', color: '#8b5cf6' },
            { label: 'Pending Orders',  value: stats.pending,                               icon: '⏳', color: '#f59e0b' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-3xl mb-3">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-sm mt-1" style={{ color: '#6b7280' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: '📊 Analytics',    href: '/analytics',   color: '#3b82f6' },
            { label: '🦴 Inventory',    href: '/inventory',   color: '#f59e0b' },
            { label: '↩️ RTO Risk',     href: '/rto',         color: '#ef4444' },
            { label: '📢 Campaigns',    href: '/campaigns',   color: '#8b5cf6' },
            { label: '✅ Tasks',        href: '/tasks',       color: '#10b981' },
            { label: '📄 Invoices',     href: '/invoices',    color: '#c8973a' },
            { label: '📦 Bulk Export',  href: '/bulk-export', color: '#6b7280' },
            { label: '📝 Activity Log', href: '/activity',    color: '#374151' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center"
              style={{ textDecoration: 'none' }}>
              <div className="font-medium text-sm" style={{ color: link.color }}>
                {link.label}
              </div>
            </a>
          ))}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold" style={{ color: '#111827' }}>Recent Orders</h2>
            <a href="/orders" style={{ color: '#c8973a', fontSize: 14, textDecoration: 'none' }}>
              View all →
            </a>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order Ref', 'Customer', 'Total', 'Payment', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>
                    Loading...
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>
                    No orders yet. Orders will appear here when customers place them.
                  </td>
                </tr>
              ) : recent.map(order => {
                const sc = STATUS_COLORS[order.status] || { bg: '#f3f4f6', color: '#374151' }
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
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
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{ background: sc.bg, color: sc.color }}>
                        {order.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}