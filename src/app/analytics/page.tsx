'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { authedFetch } from '@/app/lib/authedFetch'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AnalyticsPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState('30')
  const [tab, setTab]         = useState('overview')

  // Meta Ads spend — populated nightly by the /api/meta-ads-sync cron into
  // the `ad_spend` table (platform = 'meta'). Empty until campaigns exist.
  const [metaAds, setMetaAds] = useState<any[]>([])
  
  // Google Analytics data
  const [gaData, setGaData] = useState({
    activeUsers: 0,
    sessions: 0,
    bounceRate: 0,
    conversions: 0
  })
  const [trafficSources, setTrafficSources] = useState<any[]>([])
  const [topPages, setTopPages] = useState<any[]>([])
  const [landingPages, setLandingPages] = useState<any[]>([])
  const [geoCities, setGeoCities] = useState<any[]>([])
  const [engagement, setEngagement] = useState({
    avgEngagementSeconds: 0,
    newUsers: 0,
    returningUsers: 0
  })

  useEffect(() => { fetchData(); fetchMetaAds() }, [range])

  // Fetch GA data
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

  async function fetchData() {
    setLoading(true)
    
    // Fetch all orders (no date filter for test data to work)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by date range client-side for flexibility
    const now = new Date()
    const rangeMs = parseInt(range) * 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - rangeMs)

    const filtered = (data || []).filter(o => {
      const orderDate = new Date(o.created_at)
      return orderDate >= cutoff
    })

    setOrders(filtered)
    setLoading(false)
  }

  async function fetchMetaAds() {
    const { data } = await supabase
      .from('ad_spend')
      .select('*')
      .eq('platform', 'meta')
      .order('date', { ascending: false })

    const now = new Date()
    const rangeMs = parseInt(range) * 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - rangeMs)

    const filtered = (data || []).filter(a => new Date(a.date) >= cutoff)
    setMetaAds(filtered)
  }

  // — Calculations —

  const totalRevenue    = orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
  const totalOrders     = orders.length
  const avgOrderValue   = totalOrders ? Math.round(totalRevenue / totalOrders) : 0
  const codOrders       = orders.filter(o => o.payment_method === 'cod').length
  const prepaidOrders   = orders.filter(o => o.payment_method !== 'cod').length
  const codPct          = totalOrders ? Math.round((codOrders / totalOrders) * 100) : 0
  const rtoOrders       = orders.filter(o => o.status === 'rto').length
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length
  const rtoRate         = totalOrders ? Math.round((rtoOrders / totalOrders) * 100) : 0

  // Revenue by category
  const categoryRevenue: Record<string, number> = {}
  orders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach((item: any) => {
        const cat = item.category || item.product_name || 'Other'
        const itemTotal = (item.price || item.pack_price || 0) * (item.qty || item.quantity || 1)
        categoryRevenue[cat] = (categoryRevenue[cat] || 0) + itemTotal
      })
    }
  })
  const topCategories = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])

  // State-wise orders
  const stateOrders: Record<string, number> = {}
  orders.forEach(o => {
    const state = o.shipping_address?.state || 'Unknown'
    stateOrders[state] = (stateOrders[state] || 0) + 1
  })
  const topStates = Object.entries(stateOrders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // RTO by state
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

  // Peak hours
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

  // Coupon usage
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

  // Monthly revenue trend
  const monthlyRevenue: Record<string, number> = {}
  orders.forEach(o => {
    const month = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (o.grand_total || o.total_amount || 0)
  })

  // AOV trend by week
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

  // P&L estimate (assuming 40% cost of goods)
  const estimatedCOGS   = totalRevenue * 0.4
  const estimatedProfit = totalRevenue - estimatedCOGS
  const profitMargin    = totalRevenue ? Math.round((estimatedProfit / totalRevenue) * 100) : 0

  const maxCatRevenue = topCategories[0]?.[1] || 1
  const maxStateOrders = topStates[0]?.[1] || 1

  // Meta Ads performance (from ad_spend, synced nightly by /api/meta-ads-sync)
  const metaSpend       = metaAds.reduce((s, a) => s + (a.amount || 0), 0)
  const metaImpressions = metaAds.reduce((s, a) => s + (a.impressions || 0), 0)
  const metaClicks      = metaAds.reduce((s, a) => s + (a.clicks || 0), 0)
  const metaOrdersAttr  = metaAds.reduce((s, a) => s + (a.orders_attributed || 0), 0)
  const metaRevenueAttr = metaAds.reduce((s, a) => s + (a.revenue_attributed || 0), 0)
  const metaROAS        = metaSpend > 0 ? metaRevenueAttr / metaSpend : 0
  const metaCTR         = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0
  const metaCPC         = metaClicks > 0 ? metaSpend / metaClicks : 0
  const metaCAC         = metaOrdersAttr > 0 ? metaSpend / metaOrdersAttr : 0

  const navLinks = [
    { label: 'Dashboard',  href: '/dashboard' },
    { label: 'Orders',     href: '/orders' },
    { label: 'Products',   href: '/products' },
    { label: 'Customers',  href: '/customers' },
    { label: 'Coupons',    href: '/coupons' },
    { label: 'Banners',    href: '/banners' },
    { label: 'Analytics',  href: '/analytics' },
    { label: 'Inventory',  href: '/inventory' },
    { label: 'RTO Risk',   href: '/rto' },
  ]

  const tabs = ['overview', 'categories', 'geography', 'operations', 'pnl']

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦴</span>
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Analytics</h1>
          <select value={range} onChange={e => setRange(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none"
            style={{ color: '#111827' }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
        </div>

        {/* Tabs */}
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

        {/* — OVERVIEW TAB — */}
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Revenue',     value: '₹' + totalRevenue.toLocaleString('en-IN'), icon: '💰', color: '#10b981' },
                { label: 'Total Orders',      value: totalOrders,                                  icon: '📦', color: '#3b82f6' },
                { label: 'Avg Order Value',   value: '₹' + avgOrderValue.toLocaleString('en-IN'), icon: '📊', color: '#8b5cf6' },
                { label: 'RTO Rate',          value: rtoRate + '%',                                icon: '↩️', color: '#ef4444' },
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

            {/* Meta Ads Performance */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: '#111827' }}>Meta Ads Performance</h3>
                <a href="/marketing" className="text-xs font-medium" style={{ color: '#3b82f6' }}>Manage in Marketing →</a>
              </div>
              {loading ? (
                <div style={{ color: '#2a1f1a', fontSize: 14 }}>Loading...</div>
              ) : metaAds.length === 0 ? (
                <div style={{ color: '#2a1f1a', fontSize: 14 }}>
                  No Meta ad spend in this range yet. Once campaigns are running, spend and results sync here automatically every night — nothing more to set up.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    {[
                      { label: 'Ad Spend',           value: '₹' + metaSpend.toLocaleString('en-IN'),        color: '#ef4444' },
                      { label: 'Revenue Attributed',  value: '₹' + metaRevenueAttr.toLocaleString('en-IN'), color: '#10b981' },
                      { label: 'ROAS',                value: metaROAS.toFixed(2) + 'x',                     color: metaROAS >= 2 ? '#10b981' : '#ef4444' },
                      { label: 'Orders from Ads',     value: metaOrdersAttr,                                color: '#3b82f6' },
                      { label: 'Cost per Order',      value: metaCAC > 0 ? '₹' + Math.round(metaCAC).toLocaleString('en-IN') : '—', color: '#8b5cf6' },
                    ].map(card => (
                      <div key={card.label} className="rounded-lg p-4" style={{ background: '#f9fafb' }}>
                        <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
                        <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#6b7280' }}>
                    <div>{metaImpressions.toLocaleString('en-IN')} impressions</div>
                    <div>{metaClicks.toLocaleString('en-IN')} clicks · {metaCTR.toFixed(2)}% CTR</div>
                    <div>₹{metaCPC.toFixed(2)} avg. CPC</div>
                  </div>
                </>
              )}
            </div>

            {/* GA KPI Cards */}
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

            {/* GA engagement KPI cards */}
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
              {/* COD vs Prepaid */}
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

              {/* Peak hours */}
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

            {/* Traffic Sources */}
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

            {/* Top Pages & Landing Pages */}
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

            {/* Coupon usage */}
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

        {/* — CATEGORIES TAB — */}
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

        {/* — GEOGRAPHY TAB — */}
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

            {/* GA website visitors by city */}
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

        {/* — OPERATIONS TAB — */}
        {tab === 'operations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Delivered Orders', value: deliveredOrders, icon: '✅', color: '#10b981' },
                { label: 'RTO Orders',        value: rtoOrders,       icon: '⚠️', color: '#ef4444' },
                { label: 'RTO Rate',          value: rtoRate + '%',   icon: '📉', color: '#f59e0b' },
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
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 14 }}>
                  Repeat purchase data will appear here once you have multiple orders from the same customers
                </div>
              </div>
            </div>
          </div>
        )}

        {/* — P&L TAB — */}
        {tab === 'pnl' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Revenue',    value: '₹' + totalRevenue.toLocaleString('en-IN'),    icon: '💰', color: '#10b981' },
                { label: 'Est. COGS (40%)',  value: '₹' + Math.round(estimatedCOGS).toLocaleString('en-IN'), icon: '📤', color: '#ef4444' },
                { label: 'Est. Gross Profit', value: '₹' + Math.round(estimatedProfit).toLocaleString('en-IN'), icon: '📈', color: '#3b82f6' },
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