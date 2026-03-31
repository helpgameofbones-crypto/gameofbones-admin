'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Bell, Package, AlertTriangle, TrendingDown, RefreshCw, CheckCheck, ShoppingCart, Users, X } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NotificationsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ords }, { data: prods }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_active', true),
    ])
    setOrders(ords || [])
    setProducts(prods || [])
    setLoading(false)
  }

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
  }

  // Generate alerts
  const alerts: { id: string; type: string; priority: 'high' | 'medium' | 'low'; title: string; description: string; action?: string; actionHref?: string; time?: string }[] = []

  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000

  // New orders in last 24h
  const newOrders = orders.filter(o => now - new Date(o.created_at).getTime() < oneDayMs)
  if (newOrders.length > 0) {
    alerts.push({
      id: 'new-orders',
      type: 'orders',
      priority: 'high',
      title: `${newOrders.length} new order${newOrders.length > 1 ? 's' : ''} today`,
      description: `â‚¹${newOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0).toLocaleString('en-IN')} in revenue today`,
      action: 'View Orders',
      actionHref: '/orders',
      time: 'Today',
    })
  }

  // Pending orders not updated in 24h
  const stalePending = orders.filter(o =>
    ['placed', 'confirmed'].includes(o.status) &&
    now - new Date(o.created_at).getTime() > oneDayMs
  )
  if (stalePending.length > 0) {
    alerts.push({
      id: 'stale-pending',
      type: 'warning',
      priority: 'high',
      title: `${stalePending.length} orders stuck in pending for 24h+`,
      description: 'These orders haven\'t moved to packed status yet',
      action: 'Review Orders',
      actionHref: '/orders',
    })
  }

  // Low stock
  const lowStock = products.filter(p => p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10))
  if (lowStock.length > 0) {
    alerts.push({
      id: 'low-stock',
      type: 'warning',
      priority: 'medium',
      title: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low on stock`,
      description: lowStock.map(p => p.name).join(', '),
      action: 'View Inventory',
      actionHref: '/inventory',
    })
  }

  // Out of stock
  const outOfStock = products.filter(p => p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity === 0)
  if (outOfStock.length > 0) {
    alerts.push({
      id: 'out-of-stock',
      type: 'danger',
      priority: 'high',
      title: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} out of stock`,
      description: outOfStock.map(p => p.name).join(', '),
      action: 'View Inventory',
      actionHref: '/inventory',
    })
  }

  // COD orders not confirmed
  const unconfirmedCOD = orders.filter(o =>
    o.payment_method === 'cod' &&
    (o.cod_confirmed === null || o.cod_confirmed === undefined) &&
    ['placed', 'confirmed'].includes(o.status)
  )
  if (unconfirmedCOD.length > 0) {
    alerts.push({
      id: 'unconfirmed-cod',
      type: 'warning',
      priority: 'high',
      title: `${unconfirmedCOD.length} COD order${unconfirmedCOD.length > 1 ? 's' : ''} not yet confirmed`,
      description: 'Call customers before dispatching to avoid RTO',
      action: 'COD Tracker',
      actionHref: '/cod-tracker',
    })
  }

  // RTO orders
  const rtoOrders = orders.filter(o => o.status === 'rto')
  if (rtoOrders.length > 0) {
    alerts.push({
      id: 'rto',
      type: 'danger',
      priority: 'medium',
      title: `${rtoOrders.length} RTO order${rtoOrders.length > 1 ? 's' : ''}`,
      description: `â‚¹${rtoOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0).toLocaleString('en-IN')} worth of returned shipments`,
      action: 'View RTO',
      actionHref: '/rto',
    })
  }

  // Abandoned carts
  const abandonedCarts = orders.filter(o => o.status === 'abandoned')
  if (abandonedCarts.length > 0) {
    alerts.push({
      id: 'abandoned',
      type: 'info',
      priority: 'medium',
      title: `${abandonedCarts.length} abandoned cart${abandonedCarts.length > 1 ? 's' : ''}`,
      description: 'Customers who added to cart but didn\'t complete checkout',
      action: 'View Carts',
      actionHref: '/abandoned-carts',
    })
  }

  // No orders today
  if (newOrders.length === 0) {
    alerts.push({
      id: 'no-orders-today',
      type: 'info',
      priority: 'low',
      title: 'No orders yet today',
      description: 'Consider running a campaign or flash sale to drive orders',
      action: 'Campaigns',
      actionHref: '/campaigns-hub',
    })
  }

  const visible = alerts.filter(a => !dismissed.has(a.id))
  const filteredAlerts = visible.filter(a => filter === 'all' || a.priority === filter || a.type === filter)

  const ICON: Record<string, any> = {
    orders: <Package size={18} className="text-blue-500" />,
    warning: <AlertTriangle size={18} className="text-yellow-500" />,
    danger: <AlertTriangle size={18} className="text-red-500" />,
    info: <Bell size={18} className="text-gray-400" />,
  }

  const BG: Record<string, string> = {
    high: 'border-l-4 border-l-red-400',
    medium: 'border-l-4 border-l-yellow-400',
    low: 'border-l-4 border-l-gray-300',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
          <p className="text-sm text-gray-500 mt-1">All alerts and important updates in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
            <RefreshCw size={14} /> Refresh
          </button>
          {dismissed.size > 0 && (
            <button onClick={() => setDismissed(new Set())} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
              Restore dismissed ({dismissed.size})
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'High Priority', count: alerts.filter(a => a.priority === 'high').length, color: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'Medium Priority', count: alerts.filter(a => a.priority === 'medium').length, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'Low Priority', count: alerts.filter(a => a.priority === 'low').length, color: 'bg-gray-50 text-gray-600 border-gray-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <div className="text-2xl font-bold">{s.count}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'high', 'medium', 'low'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {f === 'all' ? `All (${visible.length})` : f}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Checking for alerts...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
          <CheckCheck size={48} className="mx-auto mb-3 text-green-400" />
          <div className="text-lg font-semibold text-gray-700">All clear!</div>
          <div className="text-sm text-gray-400 mt-1">No alerts requiring your attention right now</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <div key={alert.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${BG[alert.priority]}`}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 shrink-0">{ICON[alert.type]}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{alert.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{alert.description}</div>
                    {alert.action && (
                      <a href={alert.actionHref}
                        className="inline-block mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 underline">
                        {alert.action} â†’
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alert.priority === 'high' ? 'bg-red-100 text-red-600' : alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                    {alert.priority}
                  </span>
                  <button onClick={() => dismiss(alert.id)} className="text-gray-300 hover:text-gray-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}