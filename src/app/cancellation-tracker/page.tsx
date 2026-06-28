'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { XCircle, MapPin, TrendingDown } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CancellationTrackerPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'by-city' | 'by-state' | 'by-reason' | 'list'>('by-city')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, ref, customer_name, customer_phone, shipping_address, payment_method, grand_total, total_amount, status, created_at, cancellation_reason')
      .eq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  function getAddress(addr: any) {
    if (!addr) return {}
    if (typeof addr === 'string') { try { return JSON.parse(addr) } catch { return {} } }
    return addr
  }

  // By city
  const cityMap: Record<string, { total: number; cod: number; prepaid: number; value: number }> = {}
  orders.forEach(o => {
    const addr = getAddress(o.shipping_address)
    const city = addr.city || 'Unknown'
    if (!cityMap[city]) cityMap[city] = { total: 0, cod: 0, prepaid: 0, value: 0 }
    cityMap[city].total++
    if (o.payment_method === 'cod') cityMap[city].cod++
    else cityMap[city].prepaid++
    cityMap[city].value += o.grand_total || o.total_amount || 0
  })
  const byCity = Object.entries(cityMap).sort((a, b) => b[1].total - a[1].total)

  // By state
  const stateMap: Record<string, { total: number; cod: number; value: number }> = {}
  orders.forEach(o => {
    const addr = getAddress(o.shipping_address)
    const state = addr.state || 'Unknown'
    if (!stateMap[state]) stateMap[state] = { total: 0, cod: 0, value: 0 }
    stateMap[state].total++
    if (o.payment_method === 'cod') stateMap[state].cod++
    stateMap[state].value += o.grand_total || o.total_amount || 0
  })
  const byState = Object.entries(stateMap).sort((a, b) => b[1].total - a[1].total)

  // By reason
  const reasonMap: Record<string, number> = {}
  orders.forEach(o => {
    const reason = o.cancellation_reason || 'No reason given'
    reasonMap[reason] = (reasonMap[reason] || 0) + 1
  })
  const byReason = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])

  const codCancellations = orders.filter(o => o.payment_method === 'cod').length
  const prepaidCancellations = orders.filter(o => o.payment_method !== 'cod').length
  const totalValue = orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)

  function formatMonth(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cancellation Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Track COD and prepaid cancellations by city, state and reason</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cancellations', value: orders.length, color: 'bg-red-50 text-red-700' },
          { label: 'COD Cancellations', value: codCancellations, color: 'bg-orange-50 text-orange-700' },
          { label: 'Prepaid Cancellations', value: prepaidCancellations, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Lost Revenue', value: '' + totalValue.toLocaleString('en-IN'), color: 'bg-gray-50 text-gray-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'by-city', label: ' By City' },
          { key: 'by-state', label: ' By State' },
          { key: 'by-reason', label: ' By Reason' },
          { key: 'list', label: ' Full List' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key as any)}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === v.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading cancellations...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
          <XCircle size={48} className="mx-auto mb-3 text-green-400" />
          <div className="text-lg font-semibold text-gray-700">No cancellations</div>
          <div className="text-sm text-gray-400 mt-1">Great job keeping cancellations at zero!</div>
        </div>
      ) : view === 'by-city' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['City', 'Total', 'COD', 'Prepaid', 'Lost Value'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byCity.map(([city, data]) => (
                <tr key={city} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400" />{city}
                  </td>
                  <td className="px-4 py-3 font-bold text-red-600">{data.total}</td>
                  <td className="px-4 py-3 text-orange-600">{data.cod}</td>
                  <td className="px-4 py-3 text-yellow-600">{data.prepaid}</td>
                  <td className="px-4 py-3 text-gray-700">{data.value.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'by-state' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['State', 'Total', 'COD', 'Lost Value', 'COD %'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byState.map(([state, data]) => (
                <tr key={state} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{state}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{data.total}</td>
                  <td className="px-4 py-3 text-orange-600">{data.cod}</td>
                  <td className="px-4 py-3 text-gray-700">{data.value.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                      {data.total > 0 ? Math.round(data.cod / data.total * 100) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'by-reason' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="space-y-3">
            {byReason.map(([reason, count]) => (
              <div key={reason}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{reason}</span>
                  <span className="font-bold text-red-600">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-red-400 h-2 rounded-full" style={{ width: Math.round(count / orders.length * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const addr = getAddress(order.shipping_address)
            return (
              <div key={order.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">#{order.ref || order.order_number}</div>
                    <div className="text-xs text-gray-400">{order.customer_name}  {order.customer_phone}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={"px-2 py-0.5 rounded-full font-medium " + (order.payment_method === 'cod' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}>
                      {order.payment_method?.toUpperCase()}
                    </span>
                    <span className="text-gray-500">{addr.city}, {addr.state}</span>
                    <span className="font-bold text-gray-900">{(order.grand_total || order.total_amount || 0).toLocaleString('en-IN')}</span>
                    <span className="text-gray-400">{formatMonth(order.created_at)}</span>
                  </div>
                </div>
                {order.cancellation_reason && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5">
                    Reason: {order.cancellation_reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
