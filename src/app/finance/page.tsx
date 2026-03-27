'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function FinancePage() {
  const [orders, setOrders]     = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('pnl')
  const [range, setRange]       = useState('30')
  const [refundOrder, setRefundOrder] = useState<any>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)

  // Break-even inputs
  const [monthlyRent, setMonthlyRent]       = useState('5000')
  const [monthlyLabour, setMonthlyLabour]   = useState('10000')
  const [monthlyAds, setMonthlyAds]         = useState('5000')
  const [monthlyOther, setMonthlyOther]     = useState('3000')
  const [avgOrderValue, setAvgOrderValue]   = useState('800')
  const [cogsPercent, setCogsPercent]       = useState('40')

  useEffect(() => { fetchData() }, [range])

  async function fetchData() {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - parseInt(range))

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)

    setOrders(ordersData || [])
    setProducts(productsData || [])
    setLoading(false)
  }

  async function saveRefund() {
    if (!refundOrder || !refundAmount) return
    setSavingRefund(true)
    await supabase.from('orders').update({
      is_refunded:   true,
      refund_amount: parseFloat(refundAmount),
      refund_reason: refundReason,
      refunded_at:   new Date().toISOString(),
    }).eq('id', refundOrder.id)

    await supabase.from('activity_log').insert({
      action:      'refund processed',
      entity_type: 'order',
      entity_id:   refundOrder.id,
      entity_name: refundOrder.ref,
      details:     `₹${refundAmount} — ${refundReason}`,
    })

    setSavingRefund(false)
    setRefundOrder(null)
    setRefundAmount('')
    setRefundReason('')
    fetchData()
  }

  // P&L Calculations
  const totalRevenue    = orders.reduce((s, o) => s + (o.grand_total || 0), 0)
  const totalDiscount   = orders.reduce((s, o) => s + (o.discount || 0), 0)
  const totalRefunds    = orders.reduce((s, o) => s + (o.refund_amount || 0), 0)
  const netRevenue      = totalRevenue - totalRefunds
  const estimatedCOGS   = netRevenue * (parseFloat(cogsPercent) / 100)
  const grossProfit     = netRevenue - estimatedCOGS
  const grossMargin     = netRevenue ? Math.round((grossProfit / netRevenue) * 100) : 0

  // Product performance
  const productStats: Record<string, { revenue: number; units: number; refunds: number }> = {}
  orders.forEach(o => {
    ;(o.items || []).forEach((item: any) => {
      const key = item.name
      if (!productStats[key]) productStats[key] = { revenue: 0, units: 0, refunds: 0 }
      productStats[key].revenue += item.price * item.qty
      productStats[key].units   += item.qty
      if (o.is_refunded) productStats[key].refunds++
    })
  })
  const topProducts = Object.entries(productStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)

  // Break-even calculation
  const fixedCosts    = parseFloat(monthlyRent || '0') + parseFloat(monthlyLabour || '0') +
                        parseFloat(monthlyAds || '0') + parseFloat(monthlyOther || '0')
  const aov           = parseFloat(avgOrderValue || '0')
  const cogs          = parseFloat(cogsPercent || '0') / 100
  const contributionMargin = aov * (1 - cogs)
  const breakEvenOrders = contributionMargin > 0
    ? Math.ceil(fixedCosts / contributionMargin)
    : 0
  const breakEvenRevenue = breakEvenOrders * aov

  // Monthly cash flow
  const monthlyData: Record<string, { revenue: number; refunds: number }> = {}
  orders.forEach(o => {
    const month = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, refunds: 0 }
    monthlyData[month].revenue += o.grand_total || 0
    monthlyData[month].refunds += o.refund_amount || 0
  })

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Finance',   href: '/finance' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Inventory', href: '/inventory' },
  ]

  const tabs = ['pnl', 'products', 'refunds', 'breakeven', 'cashflow']

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

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Finance</h1>
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
              {t === 'pnl' ? 'P&L' : t === 'breakeven' ? 'Break-even' : t === 'cashflow' ? 'Cash Flow' : t}
            </button>
          ))}
        </div>

        {/* P&L Tab */}
        {tab === 'pnl' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Gross Revenue',  value: '₹' + totalRevenue.toLocaleString('en-IN'),  icon: '💰', color: '#10b981' },
                { label: 'Discounts',      value: '-₹' + totalDiscount.toLocaleString('en-IN'), icon: '🏷️', color: '#f59e0b' },
                { label: 'Refunds',        value: '-₹' + totalRefunds.toLocaleString('en-IN'),  icon: '↩️', color: '#ef4444' },
                { label: 'Gross Margin',   value: grossMargin + '%',                             icon: '📈', color: '#8b5cf6' },
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

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>P&L Summary</h3>
              <div className="mb-4">
                <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                  COGS % (your cost of goods as % of revenue)
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range" min="10" max="80" value={cogsPercent}
                    onChange={e => setCogsPercent(e.target.value)}
                    className="w-48"
                  />
                  <span className="font-bold" style={{ color: '#1a1008' }}>{cogsPercent}%</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: 'Gross Revenue',       value: totalRevenue,                color: '#10b981', prefix: '₹' },
                    { label: 'Discounts Given',      value: -totalDiscount,             color: '#ef4444', prefix: '₹' },
                    { label: 'Refunds',              value: -totalRefunds,              color: '#ef4444', prefix: '₹' },
                    { label: 'Net Revenue',          value: netRevenue,                 color: '#3b82f6', prefix: '₹' },
                    { label: `COGS (${cogsPercent}%)`, value: -estimatedCOGS,          color: '#ef4444', prefix: '₹' },
                    { label: 'Estimated Gross Profit', value: grossProfit,             color: '#10b981', prefix: '₹' },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td className="py-3" style={{ color: '#374151' }}>{row.label}</td>
                      <td className="py-3 font-bold text-right" style={{ color: row.color }}>
                        {row.value < 0 ? '-' : ''}{row.prefix}{Math.abs(Math.round(row.value)).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {tab === 'products' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-bold" style={{ color: '#111827' }}>Product Performance</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Product','Units Sold','Revenue','Avg Price','Refunds'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                      style={{ color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
                ) : topProducts.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No sales data yet</td></tr>
                ) : topProducts.map(([name, stats], i) => (
                  <tr key={name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-5 text-center" style={{ color: '#c8973a' }}>{i+1}</span>
                        <span className="font-medium" style={{ color: '#111827' }}>{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#374151' }}>{stats.units}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#10b981' }}>
                      ₹{stats.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#374151' }}>
                      ₹{stats.units ? Math.round(stats.revenue / stats.units) : 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: stats.refunds > 0 ? '#fef2f2' : '#f0fdf4',
                                 color: stats.refunds > 0 ? '#ef4444' : '#10b981' }}>
                        {stats.refunds}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Refunds Tab */}
        {tab === 'refunds' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Total Refunds',   value: orders.filter(o => o.is_refunded).length, icon: '↩️', color: '#ef4444' },
                { label: 'Refund Amount',   value: '₹' + totalRefunds.toLocaleString('en-IN'), icon: '💸', color: '#f59e0b' },
                { label: 'Refund Rate',     value: orders.length ? Math.round((orders.filter(o=>o.is_refunded).length/orders.length)*100) + '%' : '0%', icon: '📊', color: '#8b5cf6' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold" style={{ color: '#111827' }}>Process Refund</h3>
              </div>
              <div className="p-4">
                <div className="flex gap-3 mb-4">
                  <input
                    placeholder="Search order ref..."
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none flex-1"
                    style={{ color: '#111827' }}
                    onChange={e => {
                      const found = orders.find(o => o.ref.toLowerCase().includes(e.target.value.toLowerCase()))
                      if (found) setRefundOrder(found)
                    }}
                  />
                </div>
                {refundOrder && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="font-mono font-bold mb-2" style={{ color: '#c8973a' }}>{refundOrder.ref}</div>
                    <div className="text-sm mb-3" style={{ color: '#374151' }}>
                      {refundOrder.customer_name} — ₹{refundOrder.grand_total}
                    </div>
                    <div className="space-y-3">
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        placeholder="Refund amount (₹)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ color: '#111827' }}
                      />
                      <select
                        value={refundReason}
                        onChange={e => setRefundReason(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ color: '#111827' }}>
                        <option value="">Select reason...</option>
                        <option value="Wrong product delivered">Wrong product delivered</option>
                        <option value="Damaged product">Damaged product</option>
                        <option value="Customer cancelled">Customer cancelled</option>
                        <option value="Quality issue">Quality issue</option>
                        <option value="Other">Other</option>
                      </select>
                      <button onClick={saveRefund} disabled={savingRefund}
                        className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                        style={{ background: '#ef4444' }}>
                        {savingRefund ? 'Processing...' : 'Process Refund'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-t">
                  <tr>
                    {['Order','Customer','Refund Amount','Reason','Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.filter(o => o.is_refunded).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No refunds yet</td></tr>
                  ) : orders.filter(o => o.is_refunded).map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c8973a' }}>{order.ref}</td>
                      <td className="px-4 py-3" style={{ color: '#374151' }}>{order.customer_name}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: '#ef4444' }}>₹{order.refund_amount}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>{order.refund_reason}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                        {order.refunded_at ? new Date(order.refunded_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Break-even Tab */}
        {tab === 'breakeven' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Monthly Fixed Costs</h3>
              <div className="space-y-3">
                {[
                  { label: 'Rent / Storage',    key: 'rent',   val: monthlyRent,   set: setMonthlyRent },
                  { label: 'Labour / Salary',   key: 'labour', val: monthlyLabour, set: setMonthlyLabour },
                  { label: 'Ads / Marketing',   key: 'ads',    val: monthlyAds,    set: setMonthlyAds },
                  { label: 'Other Expenses',    key: 'other',  val: monthlyOther,  set: setMonthlyOther },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>
                      {field.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#6b7280' }}>₹</span>
                      <input
                        type="number"
                        value={field.val}
                        onChange={e => field.set(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ color: '#111827' }}
                      />
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 8 }}>
                  <div className="flex justify-between font-bold">
                    <span style={{ color: '#374151' }}>Total Fixed Costs</span>
                    <span style={{ color: '#ef4444' }}>₹{fixedCosts.toLocaleString('en-IN')}/month</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { label: 'Avg Order Value (₹)',  val: avgOrderValue, set: setAvgOrderValue },
                  { label: 'COGS % of revenue',    val: cogsPercent,   set: setCogsPercent },
                ].map(field => (
                  <div key={field.label}>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>
                      {field.label}
                    </label>
                    <input
                      type="number"
                      value={field.val}
                      onChange={e => field.set(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Break-even Results</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Fixed Costs/Month',       value: '₹' + fixedCosts.toLocaleString('en-IN'),          color: '#ef4444' },
                    { label: 'Contribution/Order',      value: '₹' + Math.round(contributionMargin).toLocaleString('en-IN'), color: '#3b82f6' },
                    { label: 'Break-even Orders/Month', value: breakEvenOrders + ' orders',                        color: '#f59e0b' },
                    { label: 'Break-even Revenue',      value: '₹' + breakEvenRevenue.toLocaleString('en-IN'),     color: '#10b981' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between p-3 rounded-lg"
                      style={{ background: '#f9fafb' }}>
                      <span className="text-sm" style={{ color: '#374151' }}>{row.label}</span>
                      <span className="font-bold" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-3" style={{ color: '#111827' }}>Current Performance</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#6b7280' }}>Orders this period</span>
                    <span className="font-bold">{orders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#6b7280' }}>Revenue this period</span>
                    <span className="font-bold">₹{totalRevenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#6b7280' }}>vs Break-even</span>
                    <span className="font-bold" style={{ color: orders.length >= breakEvenOrders ? '#10b981' : '#ef4444' }}>
                      {orders.length >= breakEvenOrders ? '✅ Profitable' : `Need ${breakEvenOrders - orders.length} more orders`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Tab */}
        {tab === 'cashflow' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-bold" style={{ color: '#111827' }}>Monthly Cash Flow</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Month','Revenue','Refunds','Net','Orders'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                      style={{ color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(monthlyData).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No data yet</td></tr>
                ) : Object.entries(monthlyData).map(([month, data]) => (
                  <tr key={month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{month}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#10b981' }}>
                      ₹{data.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#ef4444' }}>
                      -₹{data.refunds.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#3b82f6' }}>
                      ₹{(data.revenue - data.refunds).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#374151' }}>
                      {orders.filter(o => {
                        const m = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                        return m === month
                      }).length}
                    </td>
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
