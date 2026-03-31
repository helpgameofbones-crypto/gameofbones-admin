'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, customers: 0, pending: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weekRevenue, setWeekRevenue] = useState(0)
  const [monthRevenue, setMonthRevenue] = useState(0)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    const monthAgo = new Date(Date.now() - 30 * 86400000)

    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    const { count: customers } = await supabase.from('customers').select('*', { count: 'exact', head: true })

    const all = orders || []
    const todayOrds = all.filter(o => new Date(o.created_at) >= today)
    const revenue = todayOrds.reduce((s, o) => s + (o.grand_total || 0), 0)
    const pending = all.filter(o => ['placed','confirmed','packed','labelled','pickup_ready'].includes(o.status)).length
    const weekRev = all.filter(o => new Date(o.created_at) >= weekAgo).reduce((s, o) => s + (o.grand_total || 0), 0)
    const monthRev = all.filter(o => new Date(o.created_at) >= monthAgo).reduce((s, o) => s + (o.grand_total || 0), 0)

    setStats({ orders: todayOrds.length, revenue, customers: customers || 0, pending })
    setWeekRevenue(weekRev)
    setMonthRevenue(monthRev)
    setRecent(all.slice(0, 15))
    setLoading(false)
  }

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    placed:       { bg: '#fef3c7', color: '#92400e' },
    confirmed:    { bg: '#dbeafe', color: '#1e40af' },
    packed:       { bg: '#ede9fe', color: '#5b21b6' },
    labelled:     { bg: '#e0e7ff', color: '#3730a3' },
    pickup_ready: { bg: '#ffedd5', color: '#9a3412' },
    dispatched:   { bg: '#cffafe', color: '#155e75' },
    delivered:    { bg: '#dcfce7', color: '#166534' },
    rto:          { bg: '#fef2f2', color: '#ef4444' },
    cancelled:    { bg: '#f3f4f6', color: '#6b7280' },
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      {/* Top Bar */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#1a1008' }}>
        <div>
          <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Dashboard</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/notifications" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none' }}>🔔 Alerts</a>
          <a href="/orders" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none' }}>📦 Orders</a>
          <a href="/tasks" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none' }}>✅ Tasks</a>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* Today Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Today's Orders",  value: loading ? '...' : stats.orders,                                icon: '📦', color: '#3b82f6', bg: '#eff6ff' },
            { label: "Today's Revenue", value: loading ? '...' : '₹' + stats.revenue.toLocaleString('en-IN'), icon: '💰', color: '#10b981', bg: '#f0fdf4' },
            { label: 'Total Customers', value: loading ? '...' : stats.customers,                             icon: '👥', color: '#8b5cf6', bg: '#f5f3ff' },
            { label: 'Pending Orders',  value: loading ? '...' : stats.pending,                               icon: '⏳', color: '#f59e0b', bg: '#fffbeb' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl p-5 shadow-sm border border-gray-100" style={{ background: card.bg }}>
              <div className="text-3xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-sm mt-1 text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Last 7 Days Revenue</div>
            <div className="text-3xl font-bold text-gray-900">₹{loading ? '...' : weekRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Last 30 Days Revenue</div>
            <div className="text-3xl font-bold text-gray-900">₹{loading ? '...' : monthRevenue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'New Order',        href: '/orders',          icon: '➕', desc: 'Add manual order' },
            { label: 'COD Tracker',      href: '/cod-tracker',     icon: '📞', desc: 'Confirm COD calls' },
            { label: 'Reorder Alerts',   href: '/reorder-alerts',  icon: '🔔', desc: 'Send reminders' },
            { label: 'Production',       href: '/production',      icon: '🏭', desc: 'Log a batch' },
          ].map(action => (
            <a key={action.href} href={action.href}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all"
              style={{ textDecoration: 'none' }}>
              <div className="text-2xl mb-1">{action.icon}</div>
              <div className="font-semibold text-sm text-gray-900">{action.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{action.desc}</div>
            </a>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Recent Orders</h2>
            <a href="/orders" style={{ color: '#c8973a', fontSize: 14, textDecoration: 'none' }}>View all →</a>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order','Customer','Total','Payment','Status','Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No orders yet</td></tr>
              ) : recent.map(order => {
                const sc = STATUS_COLORS[order.status] || { bg: '#f3f4f6', color: '#374151' }
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: '#c8973a' }}>
                      {order.ref || order.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{order.customer_name}</div>
                      <div className="text-xs text-gray-400">{order.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      ₹{(order.grand_total || order.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7', color: order.payment_method === 'cod' ? '#92400e' : '#166534' }}>
                        {order.payment_method?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{ background: sc.bg, color: sc.color }}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
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