'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { TrendingUp, RefreshCw, ArrowRight } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductAffinityPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [minCount, setMinCount] = useState(2)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, items')
      .neq('status', 'cancelled')
    setOrders(data || [])
    setLoading(false)
  }

  // Build affinity pairs
  const pairMap: Record<string, { count: number; orders: number }> = {}
  const productOrderCount: Record<string, number> = {}

  orders.forEach(order => {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []
    const names = [...new Set(items.map((i: any) => i.name || i.product_name).filter(Boolean))] as string[]

    names.forEach(name => {
      productOrderCount[name] = (productOrderCount[name] || 0) + 1
    })

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join(' ||| ')
        if (!pairMap[key]) pairMap[key] = { count: 0, orders: orders.length }
        pairMap[key].count++
      }
    }
  })

  const pairs = Object.entries(pairMap)
    .map(([key, data]) => {
      const [a, b] = key.split(' ||| ')
      const support = data.orders > 0 ? (data.count / data.orders * 100).toFixed(1) : '0'
      const confidence = productOrderCount[a] > 0 ? (data.count / productOrderCount[a] * 100).toFixed(1) : '0'
      return { a, b, count: data.count, support, confidence }
    })
    .filter(p => p.count >= minCount)
    .sort((a, b) => b.count - a.count)

  // Top product bundles
  const topProducts = Object.entries(productOrderCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // For each top product, find its best pair
  const productAffinities = topProducts.map(([product, count]) => {
    const relatedPairs = pairs.filter(p => p.a === product || p.b === product)
      .map(p => ({ name: p.a === product ? p.b : p.a, count: p.count }))
      .sort((a, b) => b.count - a.count)
    return { product, orderCount: count, relatedPairs: relatedPairs.slice(0, 3) }
  })

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Affinity</h1>
          <p className="text-sm text-gray-500 mt-1">Which products are bought together most often</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Orders Analysed', value: orders.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Unique Pairs Found', value: pairs.length, color: 'bg-orange-50 text-orange-700' },
          { label: 'Min Co-purchases', value: minCount + 'x', color: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-gray-600">Show pairs bought together at least:</span>
        {[2, 3, 5, 10].map(n => (
          <button key={n} onClick={() => setMinCount(n)}
            className={"px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (minCount === n ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
            {n}x
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Analysing purchase patterns...</div>
      ) : pairs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p>Not enough data yet</p>
          <p className="text-xs mt-1">Need orders with multiple items to find affinity patterns</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Pairs */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Product Pairs</h2>
            <div className="space-y-2">
              {pairs.slice(0, 15).map((pair, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{pair.a}</span>
                      <ArrowRight size={14} className="text-orange-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-800 truncate">{pair.b}</span>
                    </div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ml-2 shrink-0">
                      {pair.count}x
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-orange-400 h-1.5 rounded-full"
                        style={{ width: Math.min(parseFloat(pair.support) * 5, 100) + '%' }} />
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 shrink-0">
                      <span>Support: {pair.support}%</span>
                      <span>Confidence: {pair.confidence}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per Product Affinities */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recommendations by Product</h2>
            <div className="space-y-3">
              {productAffinities.filter(p => p.relatedPairs.length > 0).map(pa => (
                <div key={pa.product} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-900 text-sm truncate">{pa.product}</div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{pa.orderCount} orders</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">Customers also bought:</div>
                  <div className="flex flex-wrap gap-2">
                    {pa.relatedPairs.map(rp => (
                      <div key={rp.name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-medium text-blue-700">{rp.name}</span>
                        <span className="text-xs text-blue-400">({rp.count}x)</span>
                      </div>
                    ))}
                  </div>
                  {pa.relatedPairs.length > 0 && (
                    <div className="mt-2 text-xs text-orange-600 font-medium">
                       Bundle suggestion: {pa.product} + {pa.relatedPairs[0].name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}