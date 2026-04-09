'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RefundTrackerPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'overview' | 'by-product' | 'by-month'>('overview')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ords }, { data: refs }, { data: prods }] = await Promise.all([
      supabase.from('orders').select('id, grand_total, total_amount, created_at, status, items, customer_phone, payment_method'),
      supabase.from('refunds').select('*'),
      supabase.from('products').select('id, name, price'),
    ])
    setOrders(ords || [])
    setRefunds(refs || [])
    setProducts(prods || [])
    setLoading(false)
  }

  const totalOrders = orders.filter(o => o.status !== 'cancelled').length
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
  const totalRefunds = refunds.length
  const totalRefundAmount = refunds.reduce((s, r) => s + (r.refund_amount || 0), 0)
  const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : '0.0'
  const refundAmountRate = totalRevenue > 0 ? ((totalRefundAmount / totalRevenue) * 100).toFixed(1) : '0.0'

  // By month
  const months = [...new Set(refunds.map(r => r.created_at?.slice(0, 7)))].sort().reverse()
  const byMonth = months.map(month => {
    const monthRefunds = refunds.filter(r => r.created_at?.startsWith(month))
    const monthOrders = orders.filter(o => o.created_at?.startsWith(month) && o.status !== 'cancelled')
    return {
      month,
      refunds: monthRefunds.length,
      orders: monthOrders.length,
      amount: monthRefunds.reduce((s, r) => s + (r.refund_amount || 0), 0),
      rate: monthOrders.length > 0 ? ((monthRefunds.length / monthOrders.length) * 100).toFixed(1) : '0.0',
    }
  })

  // By product
  const byProduct = products.map(product => {
    const productRefunds = refunds.filter(r => {
      const items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items || []
      return items.some((i: any) => i.product_id === product.id || i.name === product.name)
    })
    const productOrders = orders.filter(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items || []
      return items.some((i: any) => i.product_id === product.id || i.name === product.name)
    })
    return {
      name: product.name,
      refunds: productRefunds.length,
      orders: productOrders.length,
      amount: productRefunds.reduce((s, r) => s + (r.refund_amount || 0), 0),
      rate: productOrders.length > 0 ? ((productRefunds.length / productOrders.length) * 100).toFixed(1) : '0.0',
    }
  }).filter(p => p.orders > 0).sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' })
  }

  function rateColor(rate: string) {
    const r = parseFloat(rate)
    if (r >= 10) return 'text-red-600 bg-red-50'
    if (r >= 5) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Refund Rate Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">What % of orders get refunded, by product and month</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Refunds', value: totalRefunds, color: 'bg-red-50 text-red-700' },
          { label: 'Refund Rate', value: refundRate + '%', color: parseFloat(refundRate) >= 10 ? 'bg-red-50 text-red-700' : parseFloat(refundRate) >= 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700' },
          { label: 'Total Refunded', value: '' + totalRefundAmount.toLocaleString('en-IN'), color: 'bg-orange-50 text-orange-700' },
          { label: 'Revenue Impact', value: refundAmountRate + '%', color: 'bg-blue-50 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'by-product', label: 'By Product' },
          { key: 'by-month', label: 'By Month' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key as any)}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === v.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading refund data...</div>
      ) : view === 'overview' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-sm font-semibold text-gray-700 mb-4">Refund Health</div>
            <div className="space-y-3">
              {[
                { label: 'Orders Refunded', value: totalRefunds, total: totalOrders },
                { label: 'Revenue Refunded', value: totalRefundAmount, total: totalRevenue, currency: true },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{m.label}</span>
                    <span>{m.currency ? '' + m.value.toLocaleString('en-IN') : m.value} / {m.currency ? '' + m.total.toLocaleString('en-IN') : m.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: m.total > 0 ? (m.value / m.total * 100) + '%' : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-sm font-semibold text-gray-700 mb-4">Recent Refunds</div>
            {refunds.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                No refunds yet
              </div>
            ) : (
              <div className="space-y-2">
                {refunds.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="text-gray-700">{r.reason || 'No reason given'}</div>
                    <div className="font-semibold text-red-600">{(r.refund_amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : view === 'by-product' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Product', 'Orders', 'Refunds', 'Refund Rate', 'Amount Refunded'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byProduct.map(p => (
                <tr key={p.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.orders}</td>
                  <td className="px-4 py-3 text-gray-600">{p.refunds}</td>
                  <td className="px-4 py-3">
                    <span className={"text-xs font-bold px-2.5 py-1 rounded-full " + rateColor(p.rate)}>
                      {p.rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600">{p.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Month', 'Orders', 'Refunds', 'Refund Rate', 'Amount Refunded'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byMonth.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatMonth(m.month)}</td>
                  <td className="px-4 py-3 text-gray-600">{m.orders}</td>
                  <td className="px-4 py-3 text-gray-600">{m.refunds}</td>
                  <td className="px-4 py-3">
                    <span className={"text-xs font-bold px-2.5 py-1 rounded-full " + rateColor(m.rate)}>
                      {m.rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600">{m.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}