'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Phone, CheckCircle, XCircle, Clock, Search, RefreshCw } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CODTrackerPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, ref, customer_name, customer_phone, grand_total, total_amount, status, created_at, cod_confirmed, cod_confirmed_at, cod_confirmation_notes, items')
      .eq('payment_method', 'cod')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function updateConfirmation(id: string, confirmed: boolean, notes: string = '') {
    setUpdating(id)
    await supabase.from('orders').update({
      cod_confirmed: confirmed,
      cod_confirmed_at: confirmed ? new Date().toISOString() : null,
      cod_confirmation_notes: notes,
    }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? {
      ...o,
      cod_confirmed: confirmed,
      cod_confirmed_at: confirmed ? new Date().toISOString() : null,
      cod_confirmation_notes: notes,
    } : o))
    setUpdating(null)
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search) ||
      o.ref?.includes(search) || o.order_number?.includes(search)
    const matchFilter =
      filter === 'all' ||
      (filter === 'confirmed' && o.cod_confirmed === true) ||
      (filter === 'rejected' && o.cod_confirmed === false && o.cod_confirmed_at) ||
      (filter === 'pending' && o.cod_confirmed === null || o.cod_confirmed === undefined)
    return matchSearch && matchFilter
  })

  const stats = {
    total: orders.length,
    confirmed: orders.filter(o => o.cod_confirmed === true).length,
    rejected: orders.filter(o => o.cod_confirmed === false && o.cod_confirmed_at).length,
    pending: orders.filter(o => o.cod_confirmed === null || o.cod_confirmed === undefined).length,
    totalValue: orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0),
    confirmedValue: orders.filter(o => o.cod_confirmed === true).reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0),
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">COD Confirmation Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track which COD orders were confirmed by call before dispatch</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total COD Orders', value: stats.total, sub: `₹${stats.totalValue.toLocaleString('en-IN')}`, color: 'bg-blue-50 text-blue-700' },
          { label: 'Confirmed ✓', value: stats.confirmed, sub: `₹${stats.confirmedValue.toLocaleString('en-IN')}`, color: 'bg-green-50 text-green-700' },
          { label: 'Rejected ✗', value: stats.rejected, sub: 'Do not dispatch', color: 'bg-red-50 text-red-700' },
          { label: 'Pending Call', value: stats.pending, sub: 'Need to call', color: stats.pending > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-600' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone or order..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white" />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: '⏳ Pending' },
            { key: 'confirmed', label: '✓ Confirmed' },
            { key: 'rejected', label: '✗ Rejected' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading COD orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p>No COD orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const isUpdating = updating === order.id
            const isPending = order.cod_confirmed === null || order.cod_confirmed === undefined
            const isConfirmed = order.cod_confirmed === true
            const isRejected = order.cod_confirmed === false && order.cod_confirmed_at
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []

            return (
              <div key={order.id} className={`bg-white border rounded-xl p-4 shadow-sm ${isRejected ? 'border-red-200' : isConfirmed ? 'border-green-200' : 'border-yellow-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isConfirmed ? 'bg-green-100' : isRejected ? 'bg-red-100' : 'bg-yellow-100'}`}>
                      {isConfirmed ? <CheckCircle size={20} className="text-green-600" /> :
                        isRejected ? <XCircle size={20} className="text-red-500" /> :
                          <Clock size={20} className="text-yellow-600" />}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{order.customer_name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone size={11} />{order.customer_phone}
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs text-gray-400">Order</div>
                    <div className="font-mono text-sm font-semibold text-orange-600">#{order.ref || order.order_number}</div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs text-gray-400">Amount</div>
                    <div className="font-bold text-gray-900">₹{(order.grand_total || order.total_amount || 0).toLocaleString('en-IN')}</div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs text-gray-400">Ordered</div>
                    <div className="text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <>
                        <a href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors">
                          <Phone size={11} /> Call
                        </a>
                        <button onClick={() => updateConfirmation(order.id, true)} disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors">
                          <CheckCircle size={11} /> Confirm
                        </button>
                        <button onClick={() => updateConfirmation(order.id, false, 'Customer rejected')} disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors">
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {isConfirmed && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle size={11} /> Confirmed {order.cod_confirmed_at ? new Date(order.cod_confirmed_at).toLocaleDateString('en-IN') : ''}
                      </div>
                    )}
                    {isRejected && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-lg">
                          <XCircle size={11} /> Rejected
                        </div>
                        <button onClick={() => updateConfirmation(order.id, true)} disabled={isUpdating}
                          className="text-xs text-gray-500 hover:text-gray-700 underline">
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.map((item: any, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {item.name} ×{item.quantity || 1}
                      </span>
                    ))}
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