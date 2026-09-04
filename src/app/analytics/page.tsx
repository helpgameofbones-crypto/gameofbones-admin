'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authedFetch } from '@/app/lib/authedFetch'

function InsightAction({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
      <h2 className="font-bold text-sm" style={{ color: '#fffaf0' }}>{title}</h2>
      <p className="text-xs leading-5 mt-2" style={{ color: 'rgba(255,250,240,0.72)' }}>{body}</p>
      <Link href={href} className="inline-flex mt-3 text-xs font-bold underline underline-offset-4" style={{ color: '#f2ce77' }}>
        {action} →
      </Link>
    </div>
  )
}

type OrderItem = {
  category?: string
  product_name?: string
  price?: number
  pack_price?: number
  qty?: number
  quantity?: number
}

type AnalyticsOrder = {
  created_at: string
  grand_total?: number
  total_amount?: number
  payment_method?: string
  status?: string
  items?: OrderItem[]
  shipping_address?: { state?: string }
  coupon_code?: string
  discount?: number
}

type TrafficSource = { source: string; sessions: number }
type PageMetric = { path: string; title?: string; views?: number; sessions?: number }
type GeoCity = { city: string; country: string; users: number }

export default function AnalyticsPage() {
  const [orders, setOrders]   = useState<AnalyticsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState('30')
  const [tab, setTab]         = useState('overview')
  
  const [gaData, setGaData] = useState({
    activeUsers: 0,
    sessions: 0,
    bounceRate: 0,
    conversions: 0
  })
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([])
  const [topPages, setTopPages] = useState<PageMetric[]>([])
  const [landingPages, setLandingPages] = useState<PageMetric[]>([])
  const [geoCities, setGeoCities] = useState<GeoCity[]>([])
  const [engagement, setEngagement] = useState({
    avgEngagementSeconds: 0,
    newUsers: 0,
    returningUsers: 0
  })

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      try {
        const response = await authedFetch(`/api/admin/analytics?days=${encodeURIComponent(range)}`)
        const data = await response.json()
        setOrders(response.ok && Array.isArray(data.orders) ? data.orders as AnalyticsOrder[] : [])
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [range])

  useEffect(() => {
    async function fetchGA() {
      try {
        const res = await authedFetch('/api/analytics')
        const data = await res.json()
        if (data && !data.error) {
          setGaData(data)
        }
      } catch (error) {
        console.error('Failed to fetch GA data:', error)
      }
    }

    async function fetchTraffic() {
      try {
        const res = await authedFetch('/api/analytics/traffic-sources')
        const data = await res.json()
        if (Array.isArray(data)) {
          setTrafficSources(data)
        }
      } catch (error) {
        console.error('Failed to fetch traffic sources:', error)
      }
    }

    async function fetchPages() {
      try {
        const res = await authedFetch('/api/analytics/pages')
        const data = await res.json()
        if (Array.isArray(data.topPages)) setTopPages(data.topPages)
        if (Array.isArray(data.landingPages)) setLandingPages(data.landingPages)
      } catch (error) {
        console.error('Failed to fetch pages:', error)
      }
    }

    async function fetchGeo() {
      try {
        const res = await authedFetch('/api/analytics/geography')
        const data = await res.json()
        if (Array.isArray(data)) setGeoCities(data)
      } catch (error) {
        console.error('Failed to fetch geography:', error)
      }
    }

    async function fetchEngagement() {
      try {
        const res = await authedFetch('/api/analytics/engagement')
        const data = await res.json()
        if (data) setEngagement(data)
      } catch (error) {
        console.error('Failed to fetch engagement:', error)
      }
    }

    fetchGA()
    fetchTraffic()
    fetchPages()
    fetchGeo()
    fetchEngagement()
  }, [])

  const totalRevenue    = orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
  const totalOrders     = orders.length
  const avgOrderValue   = totalOrders ? Math.round(totalRevenue / totalOrders) : 0
  const codOrders       = orders.filter(o => o.payment_method === 'cod').length
  const prepaidOrders   = orders.filter(o => o.payment_method !== 'cod').length
  const codPct          = totalOrders ? Math.round((codOrders / totalOrders) * 100) : 0
  const rtoOrders       = orders.filter(o => o.status === 'rto').length
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length
  const rtoRate         = totalOrders ? Math.round((rtoOrders / totalOrders) * 100) : 0

  const categoryRevenue: Record<string, number> = {}
  orders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach((item) => {
        const cat = item.category || item.product_name || 'Other'
        const itemTotal = (item.price || item.pack_price || 0) * (item.qty || item.quantity || 1)
        categoryRevenue[cat] = (categoryRevenue[cat] || 0) + itemTotal
      })
    }
  })
  const topCategories = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])

  const stateOrders: Record<string, number> = {}
  orders.forEach(o => {
    const state = o.shipping_address?.state || 'Unknown'
    stateOrders[state] = (stateOrders[state] || 0) + 1
  })
  const topStates = Object.entries(stateOrders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const stateRTO: Record<string, { total: number; rto: number }> = {}
  orders.forEach(o => {
    const state = o.shipping_address?.state || 'Unknown'
    if (!stateRTO[state]) stateRTO[state] = { total: 0, rto: 0 }
    stateRTO[state].total++
    if (o.status === 'rto') stateRTO[state].rto++
  })
  const rtoByState = Object.entries(stateRTO)
    .map(([state, data]) => ({
      state,
      total: data.total,
      rto: data.rto,
      rate: Math.round((data.rto / data.total) * 100)
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)

  const hourCounts: Record<number, number> = {}
  orders.forEach(o => {
    const hour = new Date(o.created_at).getHours()
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  })
  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h, count]) => ({
      hour: `${h}:00 - ${parseInt(h) + 1}:00`,
      count
    }))

  const couponUsage: Record<string, { count: number; discount: number }> = {}
  orders.forEach(o => {
    if (o.coupon_code) {
      if (!couponUsage[o.coupon_code]) couponUsage[o.coupon_code] = { count: 0, discount: 0 }
      couponUsage[o.coupon_code].count++
      couponUsage[o.coupon_code].discount += (o.discount || 0)
    }
  })
  const topCoupons = Object.entries(couponUsage)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const monthlyRevenue: Record<string, number> = {}
  orders.forEach(o => {
    const month = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (o.grand_total || o.total_amount || 0)
  })

  const weeklyAOV: Record<string, { revenue: number; orders: number }> = {}
  orders.forEach(o => {
    const date = new Date(o.created_at)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const key = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    if (!weeklyAOV[key]) weeklyAOV[key] = { revenue: 0, orders: 0 }
    weeklyAOV[key].revenue += (o.grand_total || o.total_amount || 0)
    weeklyAOV[key].orders++
  })

  const estimatedCOGS   = totalRevenue * 0.4
  const estimatedProfit = totalRevenue - estimatedCOGS
  const profitMargin    = totalRevenue ? Math.round((estimatedProfit / totalRevenue) * 100) : 0
  const conversionRate = gaData.sessions ? (totalOrders / gaData.sessions) * 100 : 0
  const revenuePerSession = gaData.sessions ? Math.round(totalRevenue / gaData.sessions) : 0
  const returningVisitorRate = gaData.activeUsers
    ? Math.round((engagement.returningUsers / gaData.activeUsers) * 100)
    : 0
  const topCategory = topCategories[0]
  const topTrafficSource = trafficSources[0]
  const rtoRisk = rtoRate >= 12
  const codRisk = codPct >= 60

  const maxCatRevenue = topCategories[0]?.[1] || 1
  const maxStateOrders = topStates[0]?.[1] || 1

  const tabs = ['overview', 'categories', 'geography', 'operations', 'pnl']

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] mb-2" style={{ color: '#c8973a' }}>Decision dashboard</p>
            <h1 className="text-3xl font-bold" style={{ color: '#1a1008' }}>Insights</h1>
            <p className="text-sm mt-2 max-w-xl" style={{ color: '#6b5f55' }}>
              Sales, demand and customer signals in one place — with a clear route to the work behind each number.
            </p>
          </div>
          <select value={range} onChange={e => setRange(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none"
            style={{ color: '#111827' }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
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
              {t === 'pnl' ? 'P&L' : t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Revenue', value: '₹' + totalRevenue.toLocaleString('en-IN'), detail: `${totalOrders} orders in selected period`, color: '#0f5132' },
                { label: 'Conversion proxy', value: conversionRate.toFixed(1) + '%', detail: gaData.sessions ? `${gaData.sessions.toLocaleString('en-IN')} sessions` : 'Connect Analytics to calculate', color: '#4f46e5' },
                { label: 'Average order value', value: '₹' + avgOrderValue.toLocaleString('en-IN'), detail: `₹${revenuePerSession.toLocaleString('en-IN')} revenue / session`, color: '#9a5b13' },
                { label: 'Returning visitors', value: returningVisitorRate + '%', detail: `${engagement.returningUsers.toLocaleString('en-IN')} returning visitors`, color: '#9d174d' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {loading ? '...' : card.value}
                  </div>
                  <div className="text-xs font-semibold mt-2" style={{ color: '#1a1008' }}>{card.label}</div>
                  <div className="text-xs mt-1" style={{ color: '#81766b' }}>{card.detail}</div>
                </div>
              ))}
            </div>

            <section className="grid gap-4 lg:grid-cols-3 mb-6" aria-label="Decision signals">
              <div className="rounded-xl p-5 border lg:col-span-2" style={{ background: '#123b2f', borderColor: '#123b2f' }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: '#e8c76d' }}>What to act on</p>
                <div className="grid gap-4 mt-4 md:grid-cols-3">
                  <InsightAction
                    title={topCategory ? `${topCategory[0]} is leading` : 'Awaiting product demand data'}
                    body={topCategory ? `₹${topCategory[1].toLocaleString('en-IN')} attributed in this period.` : 'Orders with item details will surface the leading product here.'}
                    href="/product-performance"
                    action="Review product performance"
                  />
                  <InsightAction
                    title={rtoRisk ? 'RTO needs attention' : 'RTO is within watch range'}
                    body={rtoRisk ? `${rtoRate}% of selected orders are RTO. Review locations and confirmation flow.` : `${rtoRate}% RTO across the selected period.`}
                    href="/rto"
                    action="Open RTO watchlist"
                  />
                  <InsightAction
                    title={codRisk ? 'COD is carrying most orders' : 'Payment mix is balanced'}
                    body={`${codPct}% COD and ${100 - codPct}% prepaid. ${codRisk ? 'Use prepaid incentives where suitable.' : 'Keep monitoring the prepaid offer.'}`}
                    href="/cod-tracker"
                    action="Review payment mix"
                  />
                </div>
              </div>

              <div className="rounded-xl p-5 border" style={{ background: '#fff3c4', borderColor: '#e8c76d' }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: '#9a5b13' }}>Traffic quality</p>
                <h2 className="mt-3 text-xl font-bold" style={{ color: '#1a1008' }}>
                  {topTrafficSource ? topTrafficSource.source : 'Connect Google Analytics'}
                </h2>
                <p className="text-sm mt-2" style={{ color: '#625547' }}>
                  {topTrafficSource ? `${topTrafficSource.sessions.toLocaleString('en-IN')} sessions from your leading source.` : 'Traffic and landing-page insight will appear here when Analytics returns data.'}
                </p>
                <Link href="/campaigns-hub" className="inline-flex mt-4 text-sm font-bold underline underline-offset-4" style={{ color: '#6f3e0b' }}>
                  Plan a campaign →
                </Link>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8" aria-label="Insight workspaces">
              {[
                { label: 'Product demand', body: 'Best sellers, rating signals and product-level sales.', href: '/product-performance' },
                { label: 'Retention', body: 'Cohorts, repeat purchase behaviour and customer value.', href: '/cohort-analysis' },
                { label: 'Campaign impact', body: 'Source performance, offers and marketing activity.', href: '/campaigns-hub' },
                { label: 'Margin & cash', body: 'Revenue, cost inputs, settlements and profitability.', href: '/finance' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="block rounded-xl bg-white p-4 border border-gray-100 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <p className="font-bold text-sm" style={{ color: '#1a1008' }}>{item.label}</p>
                  <p className="text-xs mt-2 leading-5" style={{ color: '#6b5f55' }}>{item.body}</p>
                  <p className="text-xs mt-3 font-bold" style={{ color: '#b8721b' }}>Open report →</p>
                </Link>
              ))}
            </section>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Visitors (30d)',     value: gaData.activeUsers,               icon: '👥', color: '#06b6d4' },
                { label: 'Sessions (30d)',     value: gaData.sessions,                  icon: '📊', color: '#3b82f6' },
                { label: 'Bounce Rate',        value: gaData.bounceRate.toFixed(1) + '%', icon: '📉', color: '#f59e0b' },
                { label: 'Conversions (30d)',  value: gaData.conversions,               icon: '✅', color: '#10b981' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {loading ? '...' : card.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  label: 'New Visitors (30d)',
                  value: engagement.newUsers,
                  icon: '🆕',
                  color: '#6366f1',
                },
                {
                  label: 'Returning Visitors (30d)',
                  value: engagement.returningUsers,
                  icon: '🔁',
                  color: '#ec4899',
                },
                {
                  label: 'Avg. Engagement Time',
                  value:
                    Math.floor(engagement.avgEngagementSeconds / 60) +
                    'm ' +
                    (engagement.avgEngagementSeconds % 60) +
                    's',
                  icon: '⏱️',
                  color: '#14b8a6',
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {loading ? '...' : card.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>COD vs Prepaid</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: '#1a1008' }}>COD</span>
                      <span className="font-bold" style={{ color: '#f59e0b' }}>{codOrders} orders ({codPct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full" style={{ width: codPct + '%', background: '#f59e0b' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: '#1a1008' }}>Prepaid</span>
                      <span className="font-bold" style={{ color: '#10b981' }}>{prepaidOrders} orders ({100 - codPct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full" style={{ width: (100 - codPct) + '%', background: '#10b981' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Peak Order Hours</h3>
                {loading ? (
                  <div style={{ color: '#2a1f1a' }}>Loading...</div>
                ) : peakHours.length === 0 ? (
                  <div style={{ color: '#2a1f1a', fontSize: 14 }}>No data yet</div>
                ) : peakHours.map((h, i) => (
                  <div key={h.hour} className="flex items-center gap-3 mb-2">
                    <div className="w-6 text-xs font-bold text-center" style={{ color: '#c8973a' }}>{i + 1}</div>
                    <div className="text-sm flex-1" style={{ color: '#1a1008' }}>{h.hour}</div>
                    <div className="font-bold text-sm" style={{ color: '#111827' }}>{h.count} orders</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Traffic Sources (Last 30 Days)</h3>
              {trafficSources.length === 0 ? (
                <div style={{ color: '#2a1f1a', fontSize: 14 }}>Loading...</div>
              ) : (
                trafficSources.map((source, i) => (
                  <div key={source.source} className="flex items-center gap-3 mb-3">
                    <div className="w-6 text-xs font-bold text-center" style={{ color: '#c8973a' }}>
                      {i + 1}
                    </div>
                    <div className="text-sm flex-1" style={{ color: '#1a1008' }}>{source.source}</div>
                    <div className="font-bold text-sm" style={{ color: '#111827' }}>{source.sessions}</div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Top Pages (Last 30 Days)</h3>
                {topPages.length === 0 ? (
                  <div style={{ color: '#2a1f1a', fontSize: 14 }}>Loading...</div>
                ) : (
                  topPages.map((p, i) => (
                    <div key={p.path + i} className="flex items-center gap-3 mb-3">
                      <div className="w-6 text-xs font-bold text-center" style={{ color: '#c8973a' }}>
                        {i + 1}
                      </div>
                      <div className="text-sm flex-1 truncate" style={{ color: '#1a1008' }} title={p.path}>
                        {p.title || p.path}
                      </div>
                      <div className="font-bold text-sm" style={{ color: '#111827' }}>{p.views}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Top Landing Pages (Last 30 Days)</h3>
                {landingPages.length === 0 ? (
                  <div style={{ color: '#2a1f1a', fontSize: 14 }}>Loading...</div>
                ) : (
                  landingPages.map((p, i) => (
                    <div key={p.path + i} className="flex items-center gap-3 mb-3">
                      <div className="w-6 text-xs font-bold text-center" style={{ color: '#c8973a' }}>
                        {i + 1}
                      </div>
                      <div className="text-sm flex-1 truncate" style={{ color: '#1a1008' }} title={p.path}>
                        {p.path}
                      </div>
                      <div className="font-bold text-sm" style={{ color: '#111827' }}>{p.sessions}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Coupon Usage</h3>
              {topCoupons.length === 0 ? (
                <div style={{ color: '#2a1f1a', fontSize: 14 }}>No coupons used yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {['Coupon Code', 'Times Used', 'Total Discount Given'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold uppercase"
                          style={{ color: '#1a1008' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topCoupons.map(([code, data]) => (
                      <tr key={code} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td className="py-3 font-mono font-bold" style={{ color: '#c8973a' }}>{code}</td>
                        <td className="py-3 font-bold" style={{ color: '#111827' }}>{data.count}</td>
                        <td className="py-3 font-bold" style={{ color: '#ef4444' }}>
                          -₹{data.discount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-6" style={{ color: '#111827' }}>Revenue by Product Category</h3>
              {topCategories.length === 0 ? (
                <div style={{ color: '#2a1f1a' }}>No sales data yet</div>
              ) : topCategories.map(([cat, rev]) => {
                const pct = Math.round((rev / maxCatRevenue) * 100)
                const colors: Record<string, string> = {
                  'Chicken Hearts': '#c8973a', 'Beef Heart': '#3b82f6', 'Buffalo Bone': '#8b5cf6',
                  'Goat Bone': '#10b981', wholeprey: '#ef4444', bundle: '#f59e0b', Other: '#6b7280'
                }
                return (
                  <div key={cat} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium capitalize" style={{ color: '#1a1008' }}>{cat}</span>
                      <span className="font-bold" style={{ color: '#111827' }}>
                        ₹{rev.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div className="h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ width: pct + '%', background: colors[cat] || '#6b7280', minWidth: 40 }}>
                        <span style={{ fontSize: 10, color: 'white', fontWeight: 'bold' }}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'geography' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Top States by Orders</h3>
                {topStates.length === 0 ? (
                  <div style={{ color: '#2a1f1a' }}>No data yet</div>
                ) : topStates.map(([state, count], i) => {
                  const pct = Math.round((count / maxStateOrders) * 100)
                  return (
                    <div key={state} className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold w-5 text-center"
                            style={{ color: '#c8973a' }}>{i + 1}</span>
                          <span style={{ color: '#1a1008' }}>{state}</span>
                        </div>
                        <span className="font-bold" style={{ color: '#111827' }}>{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: pct + '%', background: '#3b82f6' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>RTO Rate by State</h3>
                {rtoByState.length === 0 ? (
                  <div style={{ color: '#2a1f1a' }}>No RTO data yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {['State', 'Orders', 'RTO', 'Rate'].map(h => (
                          <th key={h} className="text-left py-2 text-xs font-semibold uppercase"
                            style={{ color: '#1a1008' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rtoByState.map(row => (
                        <tr key={row.state} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td className="py-2" style={{ color: '#1a1008' }}>{row.state}</td>
                          <td className="py-2" style={{ color: '#111827' }}>{row.total}</td>
                          <td className="py-2" style={{ color: '#ef4444' }}>{row.rto}</td>
                          <td className="py-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{
                                background: row.rate > 20 ? '#fef2f2' : row.rate > 10 ? '#fefce8' : '#f0fdf4',
                                color: row.rate > 20 ? '#ef4444' : row.rate > 10 ? '#f59e0b' : '#10b981'
                              }}>
                              {row.rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>
                Website Visitors by City (Last 30 Days, from Google Analytics)
              </h3>
              {geoCities.length === 0 ? (
                <div style={{ color: '#2a1f1a', fontSize: 14 }}>Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {['City', 'Country', 'Visitors'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold uppercase"
                          style={{ color: '#1a1008' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {geoCities.map((row, i) => (
                      <tr key={row.city + i} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td className="py-2" style={{ color: '#1a1008' }}>{row.city}</td>
                        <td className="py-2" style={{ color: '#6b7280' }}>{row.country}</td>
                        <td className="py-2 font-bold" style={{ color: '#111827' }}>{row.users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'operations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Delivered Orders', value: deliveredOrders, icon: '', color: '#10b981' },
                { label: 'RTO Orders',        value: rtoOrders,       icon: '', color: '#ef4444' },
                { label: 'RTO Rate',          value: rtoRate + '%',   icon: '', color: '#f59e0b' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Repeat Purchase Rate</h3>
              <div className="text-center py-8" style={{ color: '#2a1f1a' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}></div>
                <div style={{ fontSize: 14 }}>
                  Repeat purchase data will appear here once you have multiple orders from the same customers
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'pnl' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Revenue',    value: '₹' + totalRevenue.toLocaleString('en-IN'),    icon: '', color: '#10b981' },
                { label: 'Est. COGS (40%)',  value: '₹' + Math.round(estimatedCOGS).toLocaleString('en-IN'), icon: '', color: '#ef4444' },
                { label: 'Est. Gross Profit', value: '₹' + Math.round(estimatedProfit).toLocaleString('en-IN'), icon: '', color: '#3b82f6' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {loading ? '...' : card.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-6" style={{ color: '#111827' }}>P&L Summary</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: 'Gross Revenue',          value: totalRevenue,                    color: '#10b981', sign: '₹' },
                    { label: 'Discounts Given',         value: orders.reduce((s,o) => s+(o.discount||0),0), color: '#ef4444', sign: '-₹' },
                    { label: 'Net Revenue',             value: totalRevenue - orders.reduce((s,o) => s+(o.discount||0),0), color: '#3b82f6', sign: '₹' },
                    { label: 'Est. Cost of Goods (40%)', value: Math.round(estimatedCOGS),    color: '#ef4444', sign: '-₹' },
                    { label: 'Est. Gross Profit',       value: Math.round(estimatedProfit),   color: '#10b981', sign: '₹' },
                    { label: 'Profit Margin',           value: profitMargin + '%',             color: '#8b5cf6', sign: '', isPercent: true },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td className="py-3" style={{ color: '#1a1008' }}>{row.label}</td>
                      <td className="py-3 font-bold text-right" style={{ color: row.color }}>
                        {row.isPercent ? row.value : row.sign + (typeof row.value === 'number' ? row.value.toLocaleString('en-IN') : row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 p-3 rounded-lg" style={{ background: '#fef3c7' }}>
                <p className="text-xs" style={{ color: '#92400e' }}>
                  Note: COGS is estimated at 40%. Go to Products page and add your actual cost prices for accurate P&L.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
