'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AnalyticsPage() {
  const [stats, setStats]       = useState<any>({})
  const [events, setEvents]     = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [range, setRange]       = useState('7')

  useEffect(() => { fetchAnalytics() }, [range])

  async function fetchAnalytics() {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - parseInt(range))

    const { data: eventsData } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })

    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('*')
      .gte('started_at', from.toISOString())

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from.toISOString())

    const ev = eventsData || []
    const se = sessionsData || []
    const or = ordersData || []

    const pageViews    = ev.filter(e => e.event_type === 'page_view').length
    const productViews = ev.filter(e => e.event_type === 'product_view').length
    const addToCarts   = ev.filter(e => e.event_type === 'add_to_cart').length
    const purchases    = or.length
    const uniqueVisitors = new Set(ev.map(e => e.visitor_id)).size
    const avgPages     = se.length ? (se.reduce((s,x) => s + (x.pages_viewed||1), 0) / se.length).toFixed(1) : 0
    const bounced      = se.filter(s => s.pages_viewed <= 1).length
    const bounceRate   = se.length ? Math.round(bounced / se.length * 100) : 0

    // Top pages
    const pageCounts: Record<string, number> = {}
    ev.filter(e => e.event_type === 'page_view').forEach(e => {
      pageCounts[e.page || 'home'] = (pageCounts[e.page || 'home'] || 0) + 1
    })

    // Top products viewed
    const prodCounts: Record<string, number> = {}
    ev.filter(e => e.event_type === 'product_view').forEach(e => {
      prodCounts[e.product_name || 'Unknown'] = (prodCounts[e.product_name || 'Unknown'] || 0) + 1
    })

    // Traffic sources
    const sourceCounts: Record<string, number> = {}
    ev.forEach(e => {
      const src = e.referrer?.includes('instagram') ? 'Instagram'
        : e.referrer?.includes('google') ? 'Google'
        : e.referrer?.includes('facebook') ? 'Facebook'
        : e.referrer?.includes('whatsapp') ? 'WhatsApp'
        : e.referrer ? 'Other' : 'Direct'
      sourceCounts[src] = (sourceCounts[src] || 0) + 1
    })

    // Devices
    const deviceCounts: Record<string, number> = {}
    ev.forEach(e => {
      const d = e.device || 'Unknown'
      deviceCounts[d] = (deviceCounts[d] || 0) + 1
    })

    setStats({
      pageViews, productViews, addToCarts, purchases,
      uniqueVisitors, avgPages, bounceRate,
      conversionRate: uniqueVisitors ? ((purchases / uniqueVisitors) * 100).toFixed(1) : 0,
      topPages: Object.entries(pageCounts).sort((a,b) => b[1]-a[1]).slice(0,5),
      topProducts: Object.entries(prodCounts).sort((a,b) => b[1]-a[1]).slice(0,5),
      sources: Object.entries(sourceCounts).sort((a,b) => b[1]-a[1]),
      devices: Object.entries(deviceCounts).sort((a,b) => b[1]-a[1]),
    })
    setEvents(ev)
    setSessions(se)
    setLoading(false)
  }

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Coupons',   href: '/coupons' },
    { label: 'Banners',   href: '/banners' },
    { label: 'Analytics', href: '/analytics' },
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
        <nav className="flex gap-1">
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
            <option value="1">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Unique Visitors',   value: stats.uniqueVisitors || 0,               icon: '👥', color: '#3b82f6' },
            { label: 'Page Views',        value: stats.pageViews || 0,                    icon: '👁️', color: '#8b5cf6' },
            { label: 'Add to Cart',       value: stats.addToCarts || 0,                   icon: '🛒', color: '#f59e0b' },
            { label: 'Orders',            value: stats.purchases || 0,                    icon: '📦', color: '#10b981' },
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

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Conversion Rate',   value: (stats.conversionRate || 0) + '%',       icon: '🎯', color: '#10b981' },
            { label: 'Bounce Rate',       value: (stats.bounceRate || 0) + '%',            icon: '↩️', color: '#ef4444' },
            { label: 'Avg Pages/Session', value: stats.avgPages || 0,                     icon: '📄', color: '#3b82f6' },
            { label: 'Product Views',     value: stats.productViews || 0,                 icon: '🦴', color: '#c8973a' },
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Conversion Funnel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold mb-4" style={{ color: '#111827' }}>Conversion Funnel</h2>
            {[
              { label: 'Visitors',      value: stats.uniqueVisitors || 0, color: '#3b82f6' },
              { label: 'Product Views', value: stats.productViews || 0,   color: '#8b5cf6' },
              { label: 'Add to Cart',   value: stats.addToCarts || 0,     color: '#f59e0b' },
              { label: 'Purchased',     value: stats.purchases || 0,      color: '#10b981' },
            ].map((step, i, arr) => {
              const max = arr[0].value || 1
              const width = Math.max(10, Math.round((step.value / max) * 100))
              return (
                <div key={step.label} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#374151' }}>{step.label}</span>
                    <span className="font-bold" style={{ color: step.color }}>{loading ? '...' : step.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all"
                      style={{ width: loading ? '0%' : width + '%', background: step.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Traffic Sources */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold mb-4" style={{ color: '#111827' }}>Traffic Sources</h2>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : !stats.sources?.length ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>
                No data yet. Add the tracking code to your website to start collecting data.
              </div>
            ) : stats.sources.map(([source, count]: [string, number]) => {
              const total = stats.sources.reduce((s: number, [,c]: [string, number]) => s + c, 0)
              const pct   = Math.round((count / total) * 100)
              const colors: Record<string, string> = {
                Instagram: '#e1306c', Google: '#4285f4',
                Facebook: '#1877f2', WhatsApp: '#25d366',
                Direct: '#6b7280', Other: '#9ca3af'
              }
              return (
                <div key={source} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#374151' }}>{source}</span>
                    <span className="font-bold" style={{ color: '#374151' }}>{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full"
                      style={{ width: pct + '%', background: colors[source] || '#6b7280' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Top Products Viewed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold mb-4" style={{ color: '#111827' }}>Top Products Viewed</h2>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : !stats.topProducts?.length ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>No product view data yet</div>
            ) : stats.topProducts.map(([name, count]: [string, number], i: number) => (
              <div key={name} className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: '#c8973a' }}>
                  {i + 1}
                </div>
                <div className="flex-1 text-sm" style={{ color: '#374151' }}>{name}</div>
                <div className="font-bold text-sm" style={{ color: '#111827' }}>{count}</div>
              </div>
            ))}
          </div>

          {/* Devices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold mb-4" style={{ color: '#111827' }}>Devices</h2>
            {loading ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>Loading...</div>
            ) : !stats.devices?.length ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>No device data yet</div>
            ) : stats.devices.map(([device, count]: [string, number]) => {
              const total = stats.devices.reduce((s: number, [,c]: [string, number]) => s + c, 0)
              const pct = Math.round((count / total) * 100)
              const icon = device === 'mobile' ? '📱' : device === 'desktop' ? '💻' : '📱'
              return (
                <div key={device} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <span className="text-2xl">{icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize" style={{ color: '#374151' }}>{device}</div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                      <div className="h-2 rounded-full" style={{ width: pct + '%', background: '#1a1008' }} />
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#111827' }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Note */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-bold mb-2" style={{ color: '#111827' }}>How to Get Analytics Data</h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Analytics data will appear here once you deploy your website and add the tracking code.
            Every page visit, product view, and add to cart will be recorded automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
