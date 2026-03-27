'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ActivityPage() {
  const [logs, setLogs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => { fetchLogs() }, [filter])

  async function fetchLogs() {
    setLoading(true)
    let q = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filter !== 'all') q = q.eq('entity_type', filter)

    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }

  function getIcon(entityType: string) {
    const icons: Record<string, string> = {
      order:    '📦',
      product:  '🦴',
      customer: '👤',
      coupon:   '🏷️',
      banner:   '🖼️',
      system:   '⚙️',
    }
    return icons[entityType] || '📝'
  }

  function getColor(action: string) {
    if (action.includes('created') || action.includes('added'))  return { bg: '#dcfce7', color: '#166534' }
    if (action.includes('updated') || action.includes('changed')) return { bg: '#dbeafe', color: '#1e40af' }
    if (action.includes('deleted') || action.includes('removed')) return { bg: '#fef2f2', color: '#ef4444' }
    if (action.includes('dispatched') || action.includes('delivered')) return { bg: '#f0fdf4', color: '#15803d' }
    return { bg: '#f3f4f6', color: '#374151' }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 1)   return 'Just now'
    if (mins < 60)  return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Activity',  href: '/activity' },
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

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Activity Log</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              Every action taken in your admin panel
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all','order','product','customer','coupon','banner','system'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
              style={{
                background: filter === f ? '#1a1008' : 'white',
                color: filter === f ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {getIcon(f)} {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#9ca3af' }}>
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <div className="font-medium mb-2" style={{ color: '#374151' }}>No activity yet</div>
            <div className="text-sm" style={{ color: '#9ca3af' }}>
              Actions like updating orders, editing products, and creating coupons will appear here
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => {
              const style = getColor(log.action)
              return (
                <div key={log.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0">{getIcon(log.entity_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: style.bg, color: style.color }}>
                        {log.action}
                      </span>
                      {log.entity_name && (
                        <span className="font-medium text-sm" style={{ color: '#111827' }}>
                          {log.entity_name}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
                        {log.details}
                      </div>
                    )}
                  </div>
                  <div className="text-xs flex-shrink-0" style={{ color: '#9ca3af' }}>
                    {timeAgo(log.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}