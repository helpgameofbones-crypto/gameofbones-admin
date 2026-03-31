'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { AlertTriangle, CheckCircle, Phone, Package } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DuplicateOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [windowHours, setWindowHours] = useState(24)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, ref, customer_name, customer_phone, grand_total, total_amount, status, created_at, items, payment_method')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  // Find duplicates — same phone, within windowHours
  const duplicateGroups: any[][] = []
  const seen = new Set<string>()

  orders.forEach(order => {
    if (seen.has(order.id)) return
    const phone = order.customer_phone
    if (!phone) return

    const windowMs = windowHours * 60 * 60 * 1000
    const orderTime = new Date(order.created_at).getTime()

    const group = orders.filter(o =>
      o.customer_phone === phone &&
      Math.abs(new Date(o.created_at).getTime() - orderTime) <= windowMs
    )

    if (group.length > 1) {
      group.forEach(o => seen.add(o.id))
      // Avoid adding duplicate groups
      const key = group.map(o => o.id).sort().join(',')
      if (!duplicateGroups.find(g => g.map(o => o.id).sort().join(',') === key)) {
        duplicateGroups.push(group)
      }
    }
  })

  const totalDuplicateOrders = duplicateGroups.reduce((s, g) => s + g.length, 0)
  const totalExtraRevenue = duplicateGroups.reduce((s, g) => {
    // Extra = all orders in group except the first one
    const sorted = [...g].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return s + sorted.slice(1).reduce((ss, o) => ss + (o.grand_total || o.total_amount || 0), 0)
  }, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duplicate Order Detector</h1>
          <p className="text-sm text-gray-500 mt-1">Same customer ordering multiple times within a time window</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Window:</span>
          {[12, 24, 48].map(h => (
            <button key={h} onClick={() => setWindowHours(h)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${windowHours === h ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 ${duplicateGroups.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-2xl font-bold ${duplicateGroups.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{duplicateGroups.length}</div>
          <div className={`text-xs font-medium mt-1 ${duplicateGroups.length > 0 ? 'text-red-600' : 'text-green-600'}`}>Duplicate Groups Found</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-700">{totalDuplicateOrders}</div>
          <div className="text-xs font-medium text-orange-600 mt-1">Orders Flagged</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-700">₹{totalExtraRevenue.toLocaleString('en-IN')}</div>
          <div className="text-xs font-medium text-blue-600 mt-1">Value of Potential Duplicates</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Scanning orders...</div>
      ) : duplicateGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
          <div className="text-lg font-semibold text-gray-700">No duplicates found</div>
          <div className="text-sm text-gray-400 mt-1">No customer has ordered more than once within {windowHours} hours</div>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group, gi) => {
            const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            const customer = sorted[0]
            return (
              <div key={gi} className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-red-50 px-4 py-3 flex items-center justify-between border-b border-red-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-red-500" />
                    <div>
                      <span className="font-semibold text-red-800">{customer.customer_name}</span>
                      <span className="text-red-600 text-sm ml-2 flex items-center gap-1 inline-flex">
                        <Phone size={11} />{customer.customer_phone}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                    {group.length} orders within {windowHours}h
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {sorted.map((order, i) => {
                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []
                    return (
                      <div key={order.id} className={`p-4 flex flex-wrap items-center justify-between gap-3 ${i === 0 ? '' : 'bg-red-50/30'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {i === 0 ? 'FIRST' : `DUPE ${i}`}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">#{order.ref || order.order_number}</div>
                            <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.slice(0, 3).map((item: any, ii: number) => (
                            <span key={ii} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item.name} ×{item.quantity || 1}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.payment_method === 'cod' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {order.payment_method?.toUpperCase()}
                          </span>
                          <span className="font-bold text-gray-900">₹{(order.grand_total || order.total_amount || 0).toLocaleString('en-IN')}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}