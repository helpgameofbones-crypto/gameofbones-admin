'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (orderData) setOrders(orderData)

    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    setCustomerCount(count || 0)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOrders = orders.filter(o => new Date(o.created_at) >= today)
  const totalRevenue = orders.reduce((s, o) => s + (o.grand_total || 0), 0)
  const pendingOrders = orders.filter(o =>
    ['placed', 'confirmed', 'packed', 'labelled', 'pickup_ready'].includes(o.status)
  ).length

  const STATUS_COLORS: Record<string, string> = {
    placed: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    packed: 'bg-purple-100 text-purple-800',
    labelled: 'bg-indigo-100 text-indigo-800',
    pickup_ready: 'bg-orange-100 text-orange-800',
    dispatched: 'bg-cyan-100 text-cyan-800',
    delivered: 'bg-green-100 text-green-800',
    rto: 'bg-red-100 text-red-800',
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>
              Game of Bones
            </div>
            <div className="text-xs text-white/50">Admin Panel</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1">
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Orders', href: '/orders' },
              { label: 'Products', href: '/products' },
              { label: 'Customers', href: '/customers' },
              { label: 'Coupons', href: '/coupons' },
              { label: 'Banners', href: '/banners' },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                {item.label}
              </a>
            ))}
          </nav>
          <button onClick={handleLogout}
            className="text-xs text-white/50 hover:text-white border border-white/20 px-3 py-1.5 rounded">
            Sign Out
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#1a1008' }}>
          Dashboard
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's Orders", value: loading ? '...' : todayOrders.length, icon: '📦', color: '#3b82f6' },
            { label: 'Total Revenue', value: loading ? '...' : '₹' + totalRevenue.toLocaleString('en-IN'), icon: '💰', color: '#10b981' },
            { label: 'Total Customers', value: loading ? '...' : customerCount, icon: '👤', color: '#8b5cf6' },
            { label: 'Pending Orders', value: loading ? '...' : pendingOrders, icon: '⏳', color: '#f59e0b' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="text-xs text-gray-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Recent Orders</h2>
            <a href="/orders" className="text-sm font-medium" style={{ color: '#c8973a' }}>
              View all →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Order Ref', 'Customer', 'Total', 'Payment', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      No orders yet. Orders will appear here when customers place them.
                    </td>
                  </tr>
                ) : orders.slice(0, 5).map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono font-bold" style={{ color: '#c8973a' }}>
                      {order.ref}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-xs text-gray-400">{order.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 font-bold">
                      ₹{order.grand_total?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        order.payment_method === 'cod'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {order.payment_method?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                        STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}