'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterCity, setFilterCity]   = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterSegment, setFilterSegment] = useState('all')
  const [selected, setSelected]   = useState<any>(null)
  const [orders, setOrders]       = useState<any[]>([])

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function fetchCustomerOrders(customerId: string) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Phone', 'Email', 'City', 'State', 'Pincode', 'Total Orders', 'Total Spent', 'Joined'],
      ...filtered.map(c => [
        c.name, c.phone, c.email || '',
        c.city || '', c.state || '', c.pincode || '',
        c.total_orders, c.total_spent,
        new Date(c.created_at).toLocaleDateString('en-IN')
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'customers.csv'
    a.click()
  }

  const allCities  = [...new Set(customers.map(c => c.city).filter(Boolean))]
  const allStates  = [...new Set(customers.map(c => c.state).filter(Boolean))]

  const filtered = customers.filter(c => {
    const matchSearch  = !search || 
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchCity    = !filterCity  || c.city === filterCity
    const matchState   = !filterState || c.state === filterState
    const matchSegment =
      filterSegment === 'all'        ? true :
      filterSegment === 'repeat'     ? c.total_orders > 1 :
      filterSegment === 'new'        ? c.total_orders === 1 :
      filterSegment === 'vip'        ? c.total_spent >= 2000 :
      filterSegment === 'inactive'   ? c.total_orders === 0 : true
    return matchSearch && matchCity && matchState && matchSegment
  })

  const totalRevenue  = filtered.reduce((s, c) => s + (c.total_spent || 0), 0)
  const repeatCount   = filtered.filter(c => c.total_orders > 1).length
  const vipCount      = filtered.filter(c => c.total_spent >= 2000).length
  const avgOrderValue = filtered.length
    ? Math.round(totalRevenue / filtered.reduce((s, c) => s + (c.total_orders || 0), 0) || 0)
    : 0

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
          <h1 className="text-2xl font-bold" style={{ color: '#1a1008' }}>Customers</h1>
          <button onClick={exportCSV}
            className="text-white text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: '#1a1008' }}>
            Export CSV
          </button>
        </div>

        {/* Segment stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Customers', value: filtered.length,                    icon: '👤', color: '#8b5cf6' },
            { label: 'Repeat Customers', value: repeatCount,                       icon: '🔄', color: '#10b981' },
            { label: 'VIP (₹2000+)',     value: vipCount,                          icon: '⭐', color: '#f59e0b' },
            { label: 'Avg Order Value',  value: '₹' + avgOrderValue.toLocaleString('en-IN'), icon: '💰', color: '#3b82f6' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
            <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="all">All Customers</option>
              <option value="new">New (1 order)</option>
              <option value="repeat">Repeat (2+ orders)</option>
              <option value="vip">VIP (₹2000+ spent)</option>
              <option value="inactive">Inactive (0 orders)</option>
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All States</option>
              {allStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All Cities</option>
              {allCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Segment tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'all',      label: 'All' },
            { key: 'new',      label: 'New Customers' },
            { key: 'repeat',   label: 'Repeat Buyers' },
            { key: 'vip',      label: 'VIP' },
            { key: 'inactive', label: 'Inactive' },
          ].map(seg => (
            <button key={seg.key} onClick={() => setFilterSegment(seg.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filterSegment === seg.key
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={filterSegment === seg.key ? { background: '#1a1008' } : {}}>
              {seg.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Phone', 'Location', 'Orders', 'Total Spent', 'Segment', 'Joined', 'Action'].map(h => (
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
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>
              ) : filtered.map(customer => {
                const isVIP    = customer.total_spent >= 2000
                const isRepeat = customer.total_orders > 1
                const isNew    = customer.total_orders === 1
                return (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{customer.name}</div>
                      <div className="text-xs text-gray-400">{customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{customer.phone}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-600">{customer.city}</div>
                      <div className="text-xs text-gray-400">{customer.state} {customer.pincode}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-center" style={{ color: '#1a1008' }}>
                      {customer.total_orders}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#10b981' }}>
                      ₹{customer.total_spent?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {isVIP    && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">VIP</span>}
                        {isRepeat && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">Repeat</span>}
                        {isNew    && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">New</span>}
                        {!isVIP && !isRepeat && !isNew && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Inactive</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(customer); fetchCustomerOrders(customer.id) }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{selected.name}</div>
                <div className="text-sm text-gray-500">{selected.phone} · {selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Orders</div>
                  <div className="text-xl font-bold" style={{ color: '#1a1008' }}>{selected.total_orders}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Spent</div>
                  <div className="text-xl font-bold" style={{ color: '#10b981' }}>
                    ₹{selected.total_spent?.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Address</div>
                <div className="text-sm text-gray-700">
                  {selected.address_line1}<br />
                  {selected.city}, {selected.state} — {selected.pincode}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Order History</div>
                {orders.length === 0 ? (
                  <div className="text-sm text-gray-400">No orders found</div>
                ) : orders.map(order => (
                  <div key={order.id} className="border border-gray-100 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono font-bold text-sm" style={{ color: '#c8973a' }}>
                          {order.ref}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {(order.items || []).map((i: any) => `${i.qty}× ${i.name}`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">₹{order.grand_total?.toLocaleString('en-IN')}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'rto' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}