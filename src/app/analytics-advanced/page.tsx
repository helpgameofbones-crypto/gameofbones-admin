'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdvancedAnalyticsPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('heatmap')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }

  // ── Hourly Heatmap ───────────────────────────────────────────────────
  const heatmapData: Record<string, Record<number, number>> = {}
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  days.forEach(d => { heatmapData[d] = {} })
  orders.forEach(o => {
    const date = new Date(o.created_at)
    const day  = days[date.getDay()]
    const hour = date.getHours()
    heatmapData[day][hour] = (heatmapData[day][hour] || 0) + 1
  })
  const maxHeatmap = Math.max(...Object.values(heatmapData).flatMap(h => Object.values(h)), 1)

  // ── City Revenue ─────────────────────────────────────────────────────
  const cityRevenue: Record<string, { revenue: number; orders: number }> = {}
  orders.forEach(o => {
    const city = o.shipping_address?.city || 'Unknown'
    if (!cityRevenue[city]) cityRevenue[city] = { revenue: 0, orders: 0 }
    cityRevenue[city].revenue += o.grand_total || 0
    cityRevenue[city].orders++
  })
  const topCities = Object.entries(cityRevenue)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 15)
  const maxCityRevenue = topCities[0]?.[1].revenue || 1

  // ── Product Affinity ─────────────────────────────────────────────────
  const pairCounts: Record<string, number> = {}
  orders.forEach(o => {
    const items = (o.items || []).map((i: any) => i.name)
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const pair = [items[a], items[b]].sort().join(' + ')
        pairCounts[pair] = (pairCounts[pair] || 0) + 1
      }
    }
  })
  const topPairs = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // ── Revenue Forecasting ──────────────────────────────────────────────
  const last30  = orders.filter(o => {
    const d = new Date(o.created_at)
    return d >= new Date(Date.now() - 30 * 86400000)
  })
  const prev30  = orders.filter(o => {
    const d = new Date(o.created_at)
    return d >= new Date(Date.now() - 60 * 86400000) && d < new Date(Date.now() - 30 * 86400000)
  })
  const last30Rev  = last30.reduce((s, o) => s + (o.grand_total || 0), 0)
  const prev30Rev  = prev30.reduce((s, o) => s + (o.grand_total || 0), 0)
  const growthRate = prev30Rev > 0 ? (last30Rev - prev30Rev) / prev30Rev : 0
  const forecast30 = Math.round(last30Rev * (1 + growthRate))
  const forecast60 = Math.round(last30Rev * Math.pow(1 + growthRate, 2))
  const forecast90 = Math.round(last30Rev * Math.pow(1 + growthRate, 3))

  // ── Cohort Analysis ──────────────────────────────────────────────────
  const cohortMap: Record<string, Set<string>> = {}
  const customerFirstOrder: Record<string, string> = {}
  orders.forEach(o => {
    const month = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (!customerFirstOrder[o.customer_phone]) {
      customerFirstOrder[o.customer_phone] = month
    }
  })
  orders.forEach(o => {
    const firstMonth = customerFirstOrder[o.customer_phone]
    if (!cohortMap[firstMonth]) cohortMap[firstMonth] = new Set()
    cohortMap[firstMonth].add(o.customer_phone)
  })
  const cohorts = Object.entries(cohortMap)
    .sort((a, b) => new Date('01 ' + a[0]).getTime() - new Date('01 ' + b[0]).getTime())
    .slice(-6)

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'Orders',      href: '/orders' },
    { label: 'Analytics',   href: '/analytics' },
    { label: 'Adv Analytics', href: '/analytics-advanced' },
    { label: 'Finance',     href: '/finance' },
    { label: 'Inventory',   href: '/inventory' },
  ]

  const tabs = ['heatmap', 'cities', 'affinity', 'forecast', 'cohort']

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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Advanced Analytics</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Deep insights — heatmap, forecasting, cohorts, product affinity
          </p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? '#1a1008' : 'white',
                color: tab === t ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t === 'heatmap' ? '🔥 Heatmap' :
               t === 'cities'  ? '🏙️ Cities' :
               t === 'affinity' ? '🔗 Affinity' :
               t === 'forecast' ? '📈 Forecast' : '👥 Cohort'}
            </button>
          ))}
        </div>

        {/* ── HEATMAP TAB ── */}
        {tab === 'heatmap' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-2" style={{ color: '#111827' }}>Order Heatmap — Day × Hour</h3>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
              Darker = more orders. Use this to plan your Instagram posts.
            </p>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>No order data yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '4px 8px', color: '#9ca3af', textAlign: 'left' }}>Day</th>
                      {Array.from({ length: 24 }, (_, i) => (
                        <th key={i} style={{ padding: '4px 4px', color: '#9ca3af', minWidth: 28 }}>
                          {i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day}>
                        <td style={{ padding: '4px 8px', fontWeight: 600, color: '#374151' }}>{day}</td>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const count = heatmapData[day][hour] || 0
                          const intensity = count / maxHeatmap
                          return (
                            <td key={hour} style={{ padding: 2 }}>
                              <div
                                title={`${day} ${hour}:00 — ${count} orders`}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  background: count === 0
                                    ? '#f3f4f6'
                                    : `rgba(200, 151, 58, ${0.15 + intensity * 0.85})`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 9,
                                  color: intensity > 0.5 ? 'white' : '#374151',
                                  fontWeight: count > 0 ? 'bold' : 'normal',
                                }}>
                                {count > 0 ? count : ''}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CITIES TAB ── */}
        {tab === 'cities' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4" style={{ color: '#111827' }}>City-wise Revenue</h3>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : topCities.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>No data yet</div>
            ) : topCities.map(([city, data], i) => {
              const pct = Math.round((data.revenue / maxCityRevenue) * 100)
              return (
                <div key={city} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold w-5 text-center" style={{ color: '#c8973a' }}>
                        {i + 1}
                      </span>
                      <span className="font-medium" style={{ color: '#374151' }}>{city}</span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>({data.orders} orders)</span>
                    </div>
                    <span className="font-bold" style={{ color: '#111827' }}>
                      ₹{data.revenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full"
                      style={{ width: pct + '%', background: '#c8973a' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── AFFINITY TAB ── */}
        {tab === 'affinity' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-2" style={{ color: '#111827' }}>Product Affinity</h3>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
              Products most frequently bought together. Use this to create bundles.
            </p>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : topPairs.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>
                No multi-item orders yet
              </div>
            ) : topPairs.map(([pair, count], i) => (
              <div key={pair} className="flex items-center gap-4 py-3 border-b border-gray-50">
                <span className="text-xs font-bold w-5 text-center" style={{ color: '#c8973a' }}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: '#111827' }}>{pair}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 rounded-full h-2" style={{ width: 80 }}>
                    <div className="h-2 rounded-full" style={{
                      width: Math.round((count / (topPairs[0][1])) * 100) + '%',
                      background: '#c8973a'
                    }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#374151' }}>
                    {count}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FORECAST TAB ── */}
        {tab === 'forecast' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Last 30 Days',    value: '₹' + last30Rev.toLocaleString('en-IN'),   icon: '📊', color: '#3b82f6' },
                { label: 'Growth Rate',     value: (growthRate >= 0 ? '+' : '') + Math.round(growthRate * 100) + '%', icon: growthRate >= 0 ? '📈' : '📉', color: growthRate >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Next 30 Day Est', value: '₹' + forecast30.toLocaleString('en-IN'),  icon: '🔮', color: '#8b5cf6' },
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

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Revenue Forecast</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { period: 'Last 30 days (actual)',  value: last30Rev,  color: '#3b82f6' },
                    { period: 'Previous 30 days',       value: prev30Rev,  color: '#6b7280' },
                    { period: 'Next 30 days (forecast)', value: forecast30, color: '#8b5cf6' },
                    { period: 'Next 60 days (forecast)', value: forecast60, color: '#8b5cf6' },
                    { period: 'Next 90 days (forecast)', value: forecast90, color: '#8b5cf6' },
                  ].map(row => (
                    <tr key={row.period} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td className="py-3" style={{ color: '#374151' }}>{row.period}</td>
                      <td className="py-3 font-bold text-right" style={{ color: row.color }}>
                        ₹{row.value.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 p-3 rounded-lg" style={{ background: '#fef3c7' }}>
                <p className="text-xs" style={{ color: '#92400e' }}>
                  Forecast is based on your growth trend from the last 60 days.
                  Actual results may vary based on seasonality and marketing spend.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── COHORT TAB ── */}
        {tab === 'cohort' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-2" style={{ color: '#111827' }}>Cohort Analysis</h3>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
              How many customers from each month came back to order again.
            </p>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : cohorts.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>No cohort data yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Cohort Month', 'New Customers', 'Returned', 'Retention Rate'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cohorts.map(([month, phones]) => {
                    const total     = phones.size
                    const returned  = orders.filter(o => {
                      const firstMonth = customerFirstOrder[o.customer_phone]
                      return firstMonth === month &&
                        phones.has(o.customer_phone) &&
                        new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) !== month
                    }).map(o => o.customer_phone)
                    const uniqueReturned = new Set(returned).size
                    const retention = Math.round((uniqueReturned / total) * 100)
                    return (
                      <tr key={month} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{month}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#3b82f6' }}>{total}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#10b981' }}>{uniqueReturned}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full"
                                style={{ width: retention + '%', background: retention > 30 ? '#10b981' : retention > 15 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                            <span className="font-bold text-sm" style={{
                              color: retention > 30 ? '#10b981' : retention > 15 ? '#f59e0b' : '#ef4444'
                            }}>
                              {retention}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
