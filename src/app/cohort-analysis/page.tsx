'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CohortAnalysisPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ords }, { data: custs }] = await Promise.all([
      supabase.from('orders').select('id, customer_phone, customer_name, grand_total, total_amount, created_at, status').neq('status', 'cancelled'),
      supabase.from('customers').select('id, phone, created_at'),
    ])
    setOrders(ords || [])
    setCustomers(custs || [])
    setLoading(false)
  }

  function getMonth(dateStr: string) {
    return dateStr?.slice(0, 7)
  }

  function formatMonth(m: string) {
    if (!m) return ''
    const [y, mo] = m.split('-')
    return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' })
  }

  // Build cohorts
  const cohortMap: Record<string, { phones: Set<string>, orders: any[] }> = {}
  orders.forEach(o => {
    const month = getMonth(o.created_at)
    if (!month) return
    if (!cohortMap[month]) cohortMap[month] = { phones: new Set(), orders: [] }
    cohortMap[month].phones.add(o.customer_phone)
    cohortMap[month].orders.push(o)
  })

  const months = Object.keys(cohortMap).sort()

  // For each cohort month, track retention in subsequent months
  const cohorts = months.map(cohortMonth => {
    const firstTimePhones = new Set<string>()
    // Find customers whose FIRST order was in this month
    cohortMap[cohortMonth]?.phones.forEach(phone => {
      const allPhoneOrders = orders.filter(o => o.customer_phone === phone)
      const firstOrder = allPhoneOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
      if (firstOrder && getMonth(firstOrder.created_at) === cohortMonth) {
        firstTimePhones.add(phone)
      }
    })

    const size = firstTimePhones.size
    const revenue = cohortMap[cohortMonth]?.orders
      .filter(o => firstTimePhones.has(o.customer_phone))
      .reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0) || 0

    // Retention per subsequent month
    const retention = months.map(m => {
      if (m < cohortMonth) return null
      const returning = orders.filter(o =>
        firstTimePhones.has(o.customer_phone) && getMonth(o.created_at) === m
      )
      const uniqueReturning = new Set(returning.map(o => o.customer_phone)).size
      return size > 0 ? Math.round((uniqueReturning / size) * 100) : 0
    })

    const avgOrderValue = size > 0 ? Math.round(revenue / size) : 0
    const totalOrders = cohortMap[cohortMonth]?.orders.filter(o => firstTimePhones.has(o.customer_phone)).length || 0
    const ordersPerCustomer = size > 0 ? (totalOrders / size).toFixed(1) : '0'

    return { cohortMonth, size, revenue, avgOrderValue, ordersPerCustomer, retention }
  })

  function retentionColor(pct: number | null) {
    if (pct === null) return 'bg-gray-50 text-gray-300'
    if (pct >= 60) return 'bg-green-600 text-white'
    if (pct >= 40) return 'bg-green-400 text-white'
    if (pct >= 25) return 'bg-green-200 text-green-800'
    if (pct >= 10) return 'bg-yellow-100 text-yellow-800'
    if (pct > 0) return 'bg-red-100 text-red-700'
    return 'bg-gray-50 text-gray-400'
  }

  const bestCohort = [...cohorts].sort((a, b) => b.revenue - a.revenue)[0]
  const bestRetention = [...cohorts].sort((a, b) => (b.retention[1] || 0) - (a.retention[1] || 0))[0]

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cohort Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">See which month's customers spend the most and come back</p>
      </div>

      {/* Key Insights */}
      {!loading && cohorts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-green-600 mb-1">💰 Highest Revenue Cohort</div>
            <div className="text-xl font-bold text-green-800">{formatMonth(bestCohort?.cohortMonth)}</div>
            <div className="text-sm text-green-700 mt-1">₹{bestCohort?.revenue.toLocaleString('en-IN')} · {bestCohort?.size} customers</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-600 mb-1">🔄 Best Retention Cohort</div>
            <div className="text-xl font-bold text-blue-800">{formatMonth(bestRetention?.cohortMonth)}</div>
            <div className="text-sm text-blue-700 mt-1">{bestRetention?.retention[1] || 0}% came back month 2</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-orange-600 mb-1">📦 Total Cohorts Tracked</div>
            <div className="text-xl font-bold text-orange-800">{cohorts.length} months</div>
            <div className="text-sm text-orange-700 mt-1">{orders.length} total orders analysed</div>
          </div>
        </div>
      )}

      {/* Cohort Summary Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Cohort Performance Summary</h2>
        </div>
        {loading ? (
          <div className="text-center py-20 text-gray-400">Analysing cohorts...</div>
        ) : cohorts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No order data yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Cohort Month', 'New Customers', 'Total Revenue', 'Avg Order Value', 'Orders/Customer'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...cohorts].reverse().map(c => (
                <tr key={c.cohortMonth} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatMonth(c.cohortMonth)}</td>
                  <td className="px-4 py-3 text-gray-700">{c.size}</td>
                  <td className="px-4 py-3 font-bold text-green-700">₹{c.revenue.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-700">₹{c.avgOrderValue.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-700">{c.ordersPerCustomer}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Retention Heatmap */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Retention Heatmap</h2>
          <p className="text-xs text-gray-400 mt-0.5">% of cohort customers who ordered again each month</p>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap sticky left-0 bg-white">Cohort</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-semibold">Size</th>
                  {months.map((m, i) => (
                    <th key={m} className="px-3 py-2 text-center text-gray-500 font-semibold whitespace-nowrap">
                      M+{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cohorts.map(c => (
                  <tr key={c.cohortMonth}>
                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-white">{formatMonth(c.cohortMonth)}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{c.size}</td>
                    {c.retention.map((pct, i) => (
                      <td key={i} className="px-1 py-1">
                        {pct !== null ? (
                          <div className={`rounded text-center px-2 py-1.5 font-semibold ${retentionColor(pct)}`}>
                            {pct}%
                          </div>
                        ) : (
                          <div className="rounded text-center px-2 py-1.5 text-gray-200">—</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}