'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { MapPin, TrendingUp, RefreshCw } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CityHeatmapPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'city' | 'state'>('city')
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('shipping_address, grand_total, total_amount, status, payment_method, created_at')
      .neq('status', 'cancelled')
    setOrders(data || [])
    setLoading(false)
  }

  function getAddress(addr: any) {
    if (!addr) return {}
    if (typeof addr === 'string') { try { return JSON.parse(addr) } catch { return {} } }
    return addr
  }

  // Build city/state stats
  const locationMap: Record<string, {
    orders: number; revenue: number; cod: number; prepaid: number;
    months: Record<string, number>
  }> = {}

  orders.forEach(o => {
    const addr = getAddress(o.shipping_address)
    const key = view === 'city'
      ? (addr.city || 'Unknown')
      : (addr.state || 'Unknown')
    if (!locationMap[key]) locationMap[key] = { orders: 0, revenue: 0, cod: 0, prepaid: 0, months: {} }
    locationMap[key].orders++
    locationMap[key].revenue += o.grand_total || o.total_amount || 0
    if (o.payment_method === 'cod') locationMap[key].cod++
    else locationMap[key].prepaid++
    const month = o.created_at?.slice(0, 7)
    if (month) locationMap[key].months[month] = (locationMap[key].months[month] || 0) + 1
  })

  const locations = Object.entries(locationMap)
    .map(([name, data]) => ({
      name,
      ...data,
      avgOrderValue: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
      codPct: data.orders > 0 ? Math.round(data.cod / data.orders * 100) : 0,
    }))
    .sort((a, b) => metric === 'orders' ? b.orders - a.orders : b.revenue - a.revenue)

  const maxOrders = Math.max(...locations.map(l => l.orders), 1)
  const maxRevenue = Math.max(...locations.map(l => l.revenue), 1)

  function heatColor(value: number, max: number) {
    const pct = value / max
    if (pct >= 0.8) return { bg: '#dc2626', text: 'white' }
    if (pct >= 0.6) return { bg: '#ea580c', text: 'white' }
    if (pct >= 0.4) return { bg: '#f97316', text: 'white' }
    if (pct >= 0.2) return { bg: '#fb923c', text: 'white' }
    if (pct >= 0.1) return { bg: '#fed7aa', text: '#9a3412' }
    return { bg: '#f3f4f6', text: '#6b7280' }
  }

  const totalOrders = orders.length
  const totalRevenue = orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
  const topLocation = locations[0]

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">City-wise Heatmap</h1>
          <p className="text-sm text-gray-500 mt-1">Where your orders are coming from</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Orders', value: totalOrders, color: 'bg-blue-50 text-blue-700' },
          { label: 'Total Revenue', value: '' + totalRevenue.toLocaleString('en-IN'), color: 'bg-green-50 text-green-700' },
          { label: view === 'city' ? 'Cities Covered' : 'States Covered', value: locations.length, color: 'bg-orange-50 text-orange-700' },
          { label: 'Top ' + (view === 'city' ? 'City' : 'State'), value: topLocation?.name || '', color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold truncate">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {(['city', 'state'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={"px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors " + (view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              By {v}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['orders', 'revenue'] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={"px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors " + (metric === m ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              By {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Analysing locations...</div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p>No location data yet</p>
          <p className="text-xs mt-1">Orders need shipping addresses to show on heatmap</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Heatmap Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-sm font-semibold text-gray-700 mb-4">
                {view === 'city' ? 'City' : 'State'} Heatmap  by {metric}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {locations.map(loc => {
                  const val = metric === 'orders' ? loc.orders : loc.revenue
                  const max = metric === 'orders' ? maxOrders : maxRevenue
                  const { bg, text } = heatColor(val, max)
                  return (
                    <div key={loc.name} className="rounded-xl p-3 text-center transition-transform hover:scale-105 cursor-default"
                      style={{ background: bg, color: text }}>
                      <div className="font-bold text-sm truncate">{loc.name}</div>
                      <div className="text-xs mt-0.5 font-medium">
                        {metric === 'orders' ? loc.orders + ' orders' : '' + Math.round(loc.revenue / 1000) + 'k'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-gray-400">Less</span>
                {['#f3f4f6', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#dc2626'].map(color => (
                  <div key={color} className="w-6 h-4 rounded" style={{ background: color }} />
                ))}
                <span className="text-xs text-gray-400">More</span>
              </div>
            </div>
          </div>

          {/* Rankings Table */}
          <div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="text-sm font-semibold text-gray-700">Top {view === 'city' ? 'Cities' : 'States'}</div>
              </div>
              <div className="divide-y divide-gray-50">
                {locations.slice(0, 15).map((loc, i) => (
                  <div key={loc.name} className="px-4 py-3 flex items-center gap-3">
                    <div className="text-lg font-bold text-gray-300 w-6 shrink-0">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1">
                        <MapPin size={10} className="text-orange-400 shrink-0" />{loc.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {loc.orders} orders  {loc.revenue.toLocaleString('en-IN')}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs text-orange-600">{loc.codPct}% COD</span>
                        <span className="text-xs text-gray-400">AOV {loc.avgOrderValue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold" style={{ color: heatColor(metric === 'orders' ? loc.orders : loc.revenue, metric === 'orders' ? maxOrders : maxRevenue).bg }}>
                        {metric === 'orders' ? loc.orders : '' + Math.round(loc.revenue / 1000) + 'k'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {Math.round((metric === 'orders' ? loc.orders / maxOrders : loc.revenue / maxRevenue) * 100)}% of top
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