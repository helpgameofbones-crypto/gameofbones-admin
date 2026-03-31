'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HourAnalysisPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'orders' | 'revenue'>('orders')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('created_at, grand_total, total_amount, status').neq('status', 'cancelled')
    setOrders(data || [])
    setLoading(false)
  }

  const hourData = Array.from({ length: 24 }, (_, hour) => {
    const hourOrders = orders.filter(o => new Date(o.created_at).getHours() === hour)
    const revenue = hourOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
    return { hour, count: hourOrders.length, revenue }
  })

  const dayData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
    const dayOrders = orders.filter(o => new Date(o.created_at).getDay() === i)
    const revenue = dayOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
    return { day, count: dayOrders.length, revenue }
  })

  const maxHourVal = Math.max(...hourData.map(h => view === 'orders' ? h.count : h.revenue), 1)
  const maxDayVal = Math.max(...dayData.map(d => view === 'orders' ? d.count : d.revenue), 1)

  const peakHour = hourData.reduce((a, b) => b.count > a.count ? b : a, hourData[0])
  const peakDay = dayData.reduce((a, b) => b.count > a.count ? b : a, dayData[0])
  const quietHour = hourData.reduce((a, b) => b.count < a.count ? b : a, hourData[0])

  function formatHour(h: number) {
    if (h === 0) return '12 AM'
    if (h < 12) return h + ' AM'
    if (h === 12) return '12 PM'
    return (h - 12) + ' PM'
  }

  function barColor(val: number, max: number) {
    const pct = val / max
    if (pct >= 0.8) return '#ef4444'
    if (pct >= 0.6) return '#f97316'
    if (pct >= 0.4) return '#f59e0b'
    if (pct >= 0.2) return '#84cc16'
    return '#d1d5db'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hour of Day Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">When do your customers order most?</p>
        </div>
        <div className="flex gap-2">
          {(['orders', 'revenue'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={"px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors " + (view === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              By {v}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-red-600 mb-1">Peak Hour</div>
            <div className="text-2xl font-bold text-red-800">{formatHour(peakHour.hour)}</div>
            <div className="text-sm text-red-700 mt-1">{peakHour.count} orders</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-600 mb-1">Best Day</div>
            <div className="text-2xl font-bold text-blue-800">{peakDay.day}</div>
            <div className="text-sm text-blue-700 mt-1">{peakDay.count} orders</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Quietest Hour</div>
            <div className="text-2xl font-bold text-gray-800">{formatHour(quietHour.hour)}</div>
            <div className="text-sm text-gray-600 mt-1">Best time for maintenance</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Hour of Day</h2>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : (
          <div className="flex items-end gap-1 h-48">
            {hourData.map(h => {
              const val = view === 'orders' ? h.count : h.revenue
              const heightPct = Math.round((val / maxHourVal) * 100)
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full rounded-t transition-all"
                    style={{ height: Math.max(heightPct, 2) + '%', background: barColor(val, maxHourVal) }} />
                  <div className="text-xs text-gray-400">
                    {h.hour % 6 === 0 ? formatHour(h.hour) : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Day of Week</h2>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {dayData.map(d => {
              const val = view === 'orders' ? d.count : d.revenue
              const heightPct = Math.round((val / maxDayVal) * 100)
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full rounded-t transition-all"
                    style={{ height: Math.max(heightPct, 2) + '%', background: barColor(val, maxDayVal) }} />
                  <div className="text-xs font-medium text-gray-600">{d.day}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}