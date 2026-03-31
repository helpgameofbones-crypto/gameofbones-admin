'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RefreshCw, Send, Clock, ShoppingBag, CheckCircle, AlertCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ReorderAlertsPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [windowDays, setWindowDays] = useState(7)
  const [filter, setFilter] = useState<'due' | 'overdue' | 'all'>('due')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ords }] = await Promise.all([
      supabase.from('orders')
        .select('id, customer_name, customer_phone, customer_email, items, created_at, grand_total, total_amount, status')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true }),
    ])
    setOrders(ords || [])
    setLoading(false)
  }

  // Group orders by customer phone
  const customerMap: Record<string, any[]> = {}
  orders.forEach(o => {
    const phone = o.customer_phone
    if (!phone) return
    if (!customerMap[phone]) customerMap[phone] = []
    customerMap[phone].push(o)
  })

  // Analyse each customer
  const customerProfiles = Object.entries(customerMap)
    .filter(([_, ords]) => ords.length >= 2)
    .map(([phone, ords]) => {
      const sorted = [...ords].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const name = sorted[sorted.length - 1].customer_name
      const email = sorted[sorted.length - 1].customer_email
      const lastOrder = sorted[sorted.length - 1]
      const lastOrderDate = new Date(lastOrder.created_at)

      // Calculate average interval between orders
      const intervals: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const diff = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()
        intervals.push(diff / 86400000) // in days
      }
      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length
      const daysSinceLastOrder = (Date.now() - lastOrderDate.getTime()) / 86400000

      // Predicted next order date
      const predictedNextOrder = new Date(lastOrderDate.getTime() + avgInterval * 86400000)
      const daysUntilDue = Math.ceil((predictedNextOrder.getTime() - Date.now()) / 86400000)

      // Most bought product
      const productCount: Record<string, number> = {}
      sorted.forEach(o => {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items || []
        items.forEach((item: any) => {
          const name = item.name || item.product_name || 'Unknown'
          productCount[name] = (productCount[name] || 0) + (item.quantity || 1)
        })
      })
      const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'their treats'

      const totalSpent = sorted.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)

      return {
        phone,
        name,
        email,
        totalOrders: sorted.length,
        avgInterval: Math.round(avgInterval),
        daysSinceLastOrder: Math.round(daysSinceLastOrder),
        daysUntilDue,
        predictedNextOrder,
        topProduct,
        totalSpent,
        lastOrderDate,
        lastOrder,
        isOverdue: daysUntilDue < -windowDays,
        isDueSoon: daysUntilDue >= -windowDays && daysUntilDue <= windowDays,
      }
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

  const filtered = customerProfiles.filter(c => {
    if (filter === 'due') return c.isDueSoon
    if (filter === 'overdue') return c.isOverdue
    return true
  })

  function generateMessage(customer: any) {
    const days = Math.abs(customer.daysUntilDue)
    const overdue = customer.daysUntilDue < 0
    return overdue
      ? `Hi ${customer.name.split(' ')[0]}! 🐾 It's been a while since ${customer.topProduct} ran out. Your dog must be missing them! Reorder now at gameofbones.in and use code REORDER10 for 10% off. 🦴`
      : `Hi ${customer.name.split(' ')[0]}! 🐾 ${customer.topProduct} is probably running low! Based on your order history, it's almost time to restock. Order now at gameofbones.in before your dog notices. 🦴`
  }

  async function sendAlert(customer: any) {
    setSending(customer.phone)

    const message = generateMessage(customer)

    // Log to Supabase
    await supabase.from('reorder_alerts').insert({
      customer_phone: customer.phone,
      customer_name: customer.name,
      customer_email: customer.email,
      message,
      product: customer.topProduct,
      days_overdue: Math.abs(customer.daysUntilDue),
      sent_at: new Date().toISOString(),
    })

    // Open WhatsApp with pre-filled message
    const encodedMsg = encodeURIComponent(message)
    const waPhone = customer.phone.replace(/\D/g, '')
    const waUrl = `https://wa.me/91${waPhone}?text=${encodedMsg}`
    window.open(waUrl, '_blank')

    setSent(prev => new Set([...prev, customer.phone]))
    setSending(null)
  }

  async function sendAllDue() {
    const dueCusts = filtered.filter(c => !sent.has(c.phone))
    for (const customer of dueCusts) {
      await sendAlert(customer)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const stats = {
    due: customerProfiles.filter(c => c.isDueSoon).length,
    overdue: customerProfiles.filter(c => c.isOverdue).length,
    total: customerProfiles.length,
    potentialRevenue: customerProfiles
      .filter(c => c.isDueSoon || c.isOverdue)
      .reduce((s, c) => s + Math.round(c.totalSpent / c.totalOrders), 0),
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reorder Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customers predicted to need a reorder based on their purchase history
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
            <RefreshCw size={14} /> Refresh
          </button>
          {filtered.length > 0 && (
            <button onClick={sendAllDue}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors">
              <Send size={14} /> Send All via WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Due This Week', value: stats.due, color: 'bg-orange-50 text-orange-700', icon: '⏰' },
          { label: 'Overdue', value: stats.overdue, color: 'bg-red-50 text-red-700', icon: '🚨' },
          { label: 'Repeat Customers', value: stats.total, color: 'bg-blue-50 text-blue-700', icon: '👥' },
          { label: 'Potential Revenue', value: '₹' + stats.potentialRevenue.toLocaleString('en-IN'), color: 'bg-green-50 text-green-700', icon: '💰' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="text-sm font-semibold text-blue-800 mb-1">How predictions work</div>
        <div className="text-xs text-blue-700">
          We look at each customer's order history and calculate their average reorder interval.
          If a customer typically reorders every 30 days and their last order was 28 days ago,
          they appear here as "due in 2 days". Clicking Send opens WhatsApp with a pre-written message.
          Only customers with 2+ orders are shown.
        </div>
      </div>

      {/* Window + Filter Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Alert window:</span>
          {[3, 5, 7, 14].map(d => (
            <button key={d} onClick={() => setWindowDays(d)}
              className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (windowDays === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              ±{d} days
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            { key: 'due', label: `⏰ Due Soon (${stats.due})` },
            { key: 'overdue', label: `🚨 Overdue (${stats.overdue})` },
            { key: 'all', label: `All (${stats.total})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={"px-3 py-2 rounded-lg text-xs font-medium transition-colors " + (filter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Analysing customer purchase patterns...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
          <div className="text-lg font-semibold text-gray-700">No customers due right now</div>
          <div className="text-sm text-gray-400 mt-1">
            Check back in a few days or widen the alert window
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(customer => {
            const isSent = sent.has(customer.phone)
            const isSending = sending === customer.phone
            const message = generateMessage(customer)

            return (
              <div key={customer.phone}
                className={"bg-white border rounded-xl overflow-hidden shadow-sm " + (customer.isOverdue ? 'border-red-200' : customer.isDueSoon ? 'border-orange-200' : 'border-gray-100')}>
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3">
                      <div className={"w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 " + (customer.isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>
                        {customer.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-400">{customer.phone}</div>
                        <div className="text-xs text-gray-400">{customer.email}</div>
                      </div>
                    </div>

                    {/* Timing Badge */}
                    <div className="text-center">
                      <div className={"text-lg font-bold " + (customer.isOverdue ? 'text-red-600' : 'text-orange-600')}>
                        {customer.daysUntilDue < 0
                          ? `${Math.abs(customer.daysUntilDue)}d overdue`
                          : customer.daysUntilDue === 0 ? 'Due today'
                          : `Due in ${customer.daysUntilDue}d`}
                      </div>
                      <div className="text-xs text-gray-400">
                        Predicted: {customer.predictedNextOrder.toLocaleDateString('en-IN')}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Orders', value: customer.totalOrders },
                        { label: 'Avg Interval', value: customer.avgInterval + 'd' },
                        { label: 'Total Spent', value: '₹' + customer.totalSpent.toLocaleString('en-IN') },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-gray-800">{s.value}</div>
                          <div className="text-xs text-gray-400">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Send Button */}
                    <div className="flex flex-col items-end gap-2">
                      {isSent ? (
                        <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle size={16} /> Sent
                        </div>
                      ) : (
                        <button onClick={() => sendAlert(customer)} disabled={isSending}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors">
                          {isSending
                            ? <RefreshCw size={14} className="animate-spin" />
                            : <Send size={14} />}
                          {isSending ? 'Opening...' : 'Send WhatsApp'}
                        </button>
                      )}
                      <div className="text-xs text-gray-400">
                        Top product: <span className="font-medium text-gray-600">{customer.topProduct}</span>
                      </div>
                    </div>
                  </div>

                  {/* Message Preview */}
                  <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
                    <div className="text-xs font-semibold text-green-700 mb-1">📱 WhatsApp Message Preview</div>
                    <div className="text-xs text-green-800">{message}</div>
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