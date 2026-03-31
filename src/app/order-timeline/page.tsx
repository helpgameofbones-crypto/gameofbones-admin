'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Truck, Clock, Search, CheckCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ZONE_DAYS: Record<string, { min: number; max: number }> = {
  metro: { min: 1, max: 2 },
  tier1: { min: 2, max: 3 },
  tier2: { min: 3, max: 5 },
  standard: { min: 4, max: 6 },
  remote: { min: 6, max: 10 },
}

export default function DeliveryEstimatorPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [pincodes, setPincodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ords }, { data: pins }] = await Promise.all([
      supabase.from('orders').select('id, order_number, ref, customer_name, customer_phone, shipping_address, status, created_at, dispatched_at, awb_number, estimated_delivery').neq('status', 'cancelled'),
      supabase.from('serviceable_pincodes').select('pincode, zone, city, state'),
    ])
    setOrders(ords || [])
    setPincodes(pins || [])
    setLoading(false)
  }

  async function setEstimate(orderId: string, date: string) {
    await supabase.from('orders').update({ estimated_delivery: date }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estimated_delivery: date } : o))
  }

  function getAddress(addr: any) {
    if (!addr) return {}
    if (typeof addr === 'string') { try { return JSON.parse(addr) } catch { return {} } }
    return addr
  }

  function estimateDelivery(order: any) {
    const addr = getAddress(order.shipping_address)
    const pincode = pincodes.find(p => p.pincode === addr.pincode)
    const zone = pincode?.zone || 'standard'
    const days = ZONE_DAYS[zone] || ZONE_DAYS.standard
    const baseDate = order.dispatched_at ? new Date(order.dispatched_at) : new Date(order.created_at)
    const minDate = new Date(baseDate.getTime() + days.min * 86400000)
    const maxDate = new Date(baseDate.getTime() + days.max * 86400000)
    return { minDate, maxDate, zone, city: pincode?.city || addr.city, state: pincode?.state || addr.state }
  }

  function isLate(order: any) {
    if (!order.estimated_delivery) return false
    return new Date(order.estimated_delivery) < new Date() && order.status !== 'delivered'
  }

  function daysUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now()
    const days = Math.ceil(diff / 86400000)
    if (days < 0) return `${Math.abs(days)}d late`
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `In ${days} days`
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.ref?.includes(search) || o.order_number?.includes(search)
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && !['delivered', 'cancelled', 'rto'].includes(o.status)) ||
      (filter === 'late' && isLate(o)) ||
      (filter === 'no-estimate' && !o.estimated_delivery)
    return matchSearch && matchFilter
  })

  const stats = {
    active: orders.filter(o => !['delivered', 'cancelled', 'rto'].includes(o.status)).length,
    late: orders.filter(o => isLate(o)).length,
    noEstimate: orders.filter(o => !o.estimated_delivery && !['delivered', 'cancelled', 'rto'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Date Estimator</h1>
        <p className="text-sm text-gray-500 mt-1">Estimated delivery dates based on pincode zone and dispatch time</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Shipments', value: stats.active, color: 'bg-blue-50 text-blue-700' },
          { label: 'Potentially Late', value: stats.late, color: stats.late > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600' },
          { label: 'No Estimate Set', value: stats.noEstimate, color: stats.noEstimate > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-600' },
          { label: 'Delivered', value: stats.delivered, color: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Zone Reference */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">Delivery Time by Zone</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(ZONE_DAYS).map(([zone, days]) => (
            <div key={zone} className="bg-gray-50 rounded-lg p-2.5 text-center">
              <div className="text-sm font-bold text-gray-800">{days.min}–{days.max} days</div>
              <div className="text-xs text-gray-500 capitalize">{zone}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white" />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'active', label: 'Active' },
            { key: 'late', label: '⚠️ Late' },
            { key: 'no-estimate', label: 'No Estimate' },
            { key: 'all', label: 'All' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={"px-3 py-2 rounded-lg text-xs font-medium transition-colors " + (filter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No orders found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const est = estimateDelivery(order)
            const late = isLate(order)
            const addr = getAddress(order.shipping_address)
            return (
              <div key={order.id} className={"bg-white border rounded-xl p-4 shadow-sm " + (late ? 'border-red-200' : 'border-gray-100')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">#{order.ref || order.order_number}</div>
                    <div className="text-xs text-gray-400">{order.customer_name} · {order.customer_phone}</div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{order.status?.replace(/_/g, ' ')}</span>
                    <span className={"px-2 py-0.5 rounded-full capitalize font-medium " + (est.zone === 'metro' ? 'bg-purple-100 text-purple-700' : est.zone === 'tier1' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                      {est.zone}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {est.city || addr.city}, {est.state || addr.state} · PIN {addr.pincode}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Auto estimate */}
                    <div className="text-xs text-gray-500">
                      <div className="font-medium text-gray-700">Est: {est.minDate.toLocaleDateString('en-IN')} – {est.maxDate.toLocaleDateString('en-IN')}</div>
                      <div className="text-gray-400">{ZONE_DAYS[est.zone]?.min}–{ZONE_DAYS[est.zone]?.max} days from {order.dispatched_at ? 'dispatch' : 'order'}</div>
                    </div>

                    {/* Manual override */}
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={order.estimated_delivery?.split('T')[0] || ''}
                        onChange={e => setEstimate(order.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-400 bg-white"
                      />
                      {order.estimated_delivery && (
                        <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + (late ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700')}>
                          {daysUntil(order.estimated_delivery)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}