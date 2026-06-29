'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  placed:       { bg: '#fef3c7', color: '#92400e', label: 'Placed' },
  confirmed:    { bg: '#dbeafe', color: '#1e40af', label: 'Confirmed' },
  packed:       { bg: '#ede9fe', color: '#5b21b6', label: 'Packed' },
  labelled:     { bg: '#e0e7ff', color: '#3730a3', label: 'Labelled' },
  pickup_ready: { bg: '#ffedd5', color: '#9a3412', label: 'Pickup Ready' },
  dispatched:   { bg: '#cffafe', color: '#155e75', label: 'Dispatched' },
  delivered:    { bg: '#dcfce7', color: '#166534', label: 'Delivered' },
  rto:          { bg: '#fef2f2', color: '#ef4444', label: 'RTO' },
  cancelled:    { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled' },
}

const NEEDS_ACTION = ['placed', 'confirmed', 'packed', 'labelled', 'pickup_ready']

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [newCustomers7d, setNewCustomers7d] = useState(0)
  const [lowStock, setLowStock] = useState<any[]>([])
  const [expenses30d, setExpenses30d] = useState(0)
  const [emailCaptures, setEmailCaptures] = useState(0)
  const [couponsActive, setCouponsActive] = useState(0)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const now = new Date()
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    // Orders (all)
    const { data: orderData } = await supabase
      .from('orders').select('id,ref,customer_name,customer_phone,grand_total,total_amount,payment_method,status,created_at,delhivery_awb,items')
      .order('created_at', { ascending: false })
    setOrders(orderData || [])

    // Customers
    const { count: custTotal } = await supabase.from('customers').select('*', { count: 'exact', head: true })
    setCustomerCount(custTotal || 0)
    const { count: custNew } = await supabase.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo)
    setNewCustomers7d(custNew || 0)

    // Low stock (product_sizes with stock < 10)
    const { data: stockData } = await supabase
      .from('product_sizes').select('id,label,stock,product_id,products(name)')
      .lt('stock', 10).order('stock', { ascending: true }).limit(10)
    setLowStock(stockData || [])

    // Expenses last 30 days
    const { data: expData } = await supabase
      .from('expenses').select('amount').gte('date', monthAgo.split('T')[0])
    setExpenses30d((expData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0))

    // Email captures total
    const { count: emailCount } = await supabase.from('email_captures').select('*', { count: 'exact', head: true })
    setEmailCaptures(emailCount || 0)

    // Active coupons
    const { count: coupCount } = await supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true)
    setCouponsActive(coupCount || 0)

    setLoading(false)
  }

  // Computed stats
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const monthAgo = new Date(Date.now() - 30 * 86400000)

  const todayOrders = orders.filter(o => new Date(o.created_at) >= today)
  const weekOrders = orders.filter(o => new Date(o.created_at) >= weekAgo)
  const monthOrders = orders.filter(o => new Date(o.created_at) >= monthAgo)

  const sum = (arr: any[]) => arr.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)
  const todayRev = sum(todayOrders)
  const weekRev = sum(weekOrders)
  const monthRev = sum(monthOrders)
  const allTimeRev = sum(orders)

  const needsAction = orders.filter(o => NEEDS_ACTION.includes(o.status))
  const codPending = orders.filter(o => o.payment_method === 'cod' && ['placed', 'confirmed'].includes(o.status))
  const dispatched = orders.filter(o => o.status === 'dispatched')
  const delivered = orders.filter(o => o.status === 'delivered')
  const cancelled = orders.filter(o => o.status === 'cancelled')
  const rto = orders.filter(o => o.status === 'rto')

  const avgOrderValue = orders.length > 0 ? Math.round(allTimeRev / orders.length) : 0
  const codRate = orders.length > 0 ? Math.round((orders.filter(o => o.payment_method === 'cod').length / orders.length) * 100) : 0

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })

  // Gross profit estimate (revenue - expenses, COGS not available yet)
  const grossProfit30d = Math.round(monthRev - expenses30d)

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9f6f2' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🐾</div>
          <div style={{ fontSize: '14px', color: '#6b5d4f' }}>Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1a1008', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#c8973a' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'Orders', href: '/orders' },
            { label: 'Inventory', href: '/inventory' },
            { label: 'Customers', href: '/customers' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: '500' }}>
              {l.label} →
            </Link>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '1400px' }}>

        {/* ═══════ ALERTS BAR ═══════ */}
        {(needsAction.length > 0 || lowStock.length > 0 || codPending.length > 0) && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {needsAction.length > 0 && (
              <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#92400e', textDecoration: 'none' }}>
                🚨 {needsAction.length} order{needsAction.length !== 1 ? 's' : ''} need{needsAction.length === 1 ? 's' : ''} action
              </Link>
            )}
            {codPending.length > 0 && (
              <Link href="/cod-tracker" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#9a3412', textDecoration: 'none' }}>
                📞 {codPending.length} COD order{codPending.length !== 1 ? 's' : ''} to confirm
              </Link>
            )}
            {lowStock.length > 0 && (
              <Link href="/inventory" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#dc2626', textDecoration: 'none' }}>
                📦 {lowStock.length} product{lowStock.length !== 1 ? 's' : ''} low on stock
              </Link>
            )}
          </div>
        )}

        {/* ═══════ KPI CARDS — ROW 1 ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
          {[
            { label: "Today's Orders", value: String(todayOrders.length), sub: `${weekOrders.length} this week`, color: '#3b82f6', bg: '#eff6ff' },
            { label: "Today's Revenue", value: fmt(todayRev), sub: `${fmt(weekRev)} this week`, color: '#10b981', bg: '#f0fdf4' },
            { label: 'Pending Dispatch', value: String(needsAction.length), sub: `${dispatched.length} in transit`, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Total Customers', value: String(customerCount), sub: `+${newCustomers7d} this week`, color: '#8b5cf6', bg: '#f5f3ff' },
          ].map(card => (
            <div key={card.label} style={{ background: card.bg, border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: card.color, lineHeight: '1.1' }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══════ KPI CARDS — ROW 2 ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: '30-Day Revenue', value: fmt(monthRev), sub: `All time: ${fmt(allTimeRev)}`, color: '#059669' },
            { label: 'Avg Order Value', value: fmt(avgOrderValue), sub: `${codRate}% COD rate`, color: '#7c3aed' },
            { label: 'Delivered', value: String(delivered.length), sub: `${cancelled.length} cancelled · ${rto.length} RTO`, color: '#166534' },
            { label: 'Gross Profit (30d)', value: expenses30d > 0 ? fmt(grossProfit30d) : '—', sub: expenses30d > 0 ? `Revenue ${fmt(monthRev)} – Expenses ${fmt(expenses30d)}` : 'Add expenses to see P&L', color: '#0d9488' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: card.color, lineHeight: '1.1' }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══════ TWO-COLUMN: ORDER FUNNEL + ALERTS ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>

          {/* Order Status Breakdown */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1008', marginBottom: '16px' }}>Order Status Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const sc = STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
                const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0
                return (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '100px', fontSize: '12px', fontWeight: '600', color: sc.color }}>{sc.label}</div>
                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, minWidth: count > 0 ? '24px' : '0', background: sc.color, height: '100%', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#fff' }}>{count}</span>
                      </div>
                    </div>
                    <div style={{ width: '36px', fontSize: '11px', color: '#9ca3af', textAlign: 'right' }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Stats & Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Low Stock */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1008' }}>Low Stock Alerts</div>
                <Link href="/inventory" style={{ fontSize: '11px', color: '#c8973a', textDecoration: 'none' }}>View all →</Link>
              </div>
              {lowStock.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 0' }}>✅ All products are well-stocked</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lowStock.slice(0, 5).map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1008' }}>{(item.products as any)?.name || 'Product'}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.label}</div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: item.stock < 3 ? '#dc2626' : '#f59e0b' }}>{item.stock} left</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Marketing snapshot */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1008', marginBottom: '12px' }}>Marketing Snapshot</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#8b5cf6' }}>{emailCaptures}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>Emails captured</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>{couponsActive}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>Active coupons</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ QUICK ACTIONS ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { icon: '🛒', label: 'Process Orders', href: '/orders', desc: 'Pack & dispatch' },
            { icon: '📞', label: 'COD Calls', href: '/cod-tracker', desc: 'Confirm payments' },
            { icon: '✏️', label: 'Manual Order', href: '/manual-order', desc: 'Phone/WA orders' },
            { icon: '📦', label: 'Inventory', href: '/inventory', desc: 'Check stock' },
            { icon: '🏷️', label: 'Coupons', href: '/coupons', desc: 'Manage codes' },
            { icon: '📤', label: 'Export Data', href: '/bulk-export', desc: 'Download CSV' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 12px', textDecoration: 'none', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{a.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1008' }}>{a.label}</div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{a.desc}</div>
            </Link>
          ))}
        </div>

        {/* ═══════ RECENT ORDERS TABLE ═══════ */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1a1008' }}>Recent Orders</h2>
            <Link href="/orders" style={{ fontSize: '12px', color: '#c8973a', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#fafaf8' }}>
                {['Order', 'Customer', 'Amount', 'Payment', 'Status', 'AWB', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 15).map(order => {
                const sc = STATUS_COLORS[order.status] || { bg: '#f3f4f6', color: '#6b7280', label: order.status }
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #f9f6f2' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#c8973a', fontFamily: 'monospace', fontSize: '12px' }}>{order.ref || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#1a1008' }}>{order.customer_name}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{order.customer_phone}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1a1008' }}>{fmt(order.grand_total || order.total_amount || 0)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7', color: order.payment_method === 'cod' ? '#92400e' : '#166534' }}>
                        {(order.payment_method || '').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: order.delhivery_awb ? '#059669' : '#d1d5db', fontFamily: 'monospace' }}>
                      {order.delhivery_awb || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ═══════ SETUP HINTS ═══════ */}
        <div style={{ marginTop: '20px', padding: '20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1008', marginBottom: '12px' }}>💡 Setup Tips</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#6b5d4f', lineHeight: '1.6' }}>
            <div style={{ padding: '10px', background: expenses30d > 0 ? '#f0fdf4' : '#fffbeb', borderRadius: '6px' }}>
              <strong>Profit & Loss:</strong> {expenses30d > 0 ? '✅ Tracking expenses' : 'Go to Finance → Expenses and log your costs (packaging, raw materials, shipping) to see profit/loss here.'}
            </div>
            <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '6px' }}>
              <strong>COGS:</strong> Set cost_price on each product in Product Manager to calculate true gross margins per product.
            </div>
            <div style={{ padding: '10px', background: lowStock.length > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px' }}>
              <strong>Stock Alerts:</strong> {lowStock.length > 0 ? `⚠️ ${lowStock.length} items below threshold` : 'Set reorder levels in Product Manager to get low-stock warnings here.'}
            </div>
            <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '6px' }}>
              <strong>Loyalty:</strong> Points auto-credit when you mark orders as &quot;delivered.&quot; See Loyalty page for customer balances.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
