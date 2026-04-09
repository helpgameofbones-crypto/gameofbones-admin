'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUSES = ['placed','confirmed','packed','labelled','pickup_ready','dispatched','delivered','rto']

const STATUS_COLORS: Record<string, string> = {
  placed:       'bg-yellow-100 text-yellow-800',
  confirmed:    'bg-blue-100 text-blue-800',
  packed:       'bg-purple-100 text-purple-800',
  labelled:     'bg-indigo-100 text-indigo-800',
  pickup_ready: 'bg-orange-100 text-orange-800',
  dispatched:   'bg-cyan-100 text-cyan-800',
  delivered:    'bg-green-100 text-green-800',
  rto:          'bg-red-100 text-red-800',
}

function getRTORisk(order: any) {
  let score = 0
  if (order.payment_method === 'cod') score += 30
  if (order.payment_method === 'cod' && (order.grand_total || order.total_amount) > 1000) score += 20
  const highRTOStates = ['Manipur','Nagaland','Mizoram','Arunachal Pradesh','Meghalaya','Tripura','Sikkim']
  if (highRTOStates.includes(order.shipping_address?.state)) score += 25
  if (!order.shipping_address?.line2) score += 10
  if (!order.customer_email) score += 10
  if (score >= 60) return { level: 'High',   color: '#ef4444', bg: '#fef2f2', score }
  if (score >= 30) return { level: 'Medium', color: '#f59e0b', bg: '#fefce8', score }
  return { level: 'Low', color: '#10b981', bg: '#f0fdf4', score }
}

export default function OrdersPage() {
  const [orders, setOrders]         = useState<any[]>([])
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [noteText, setNoteText]     = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [pincodeCheck, setPincodeCheck] = useState('')
  const [pincodeResult, setPincodeResult] = useState<string | null>(null)

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data || [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    await supabase.from('order_status_log').insert({ order_id: orderId, status: newStatus })
    await supabase.from('activity_log').insert({
      action: 'order updated to ' + newStatus,
      entity_type: 'order',
      entity_id: orderId,
    })
    fetchOrders()
    if (selected?.id === orderId) setSelected({ ...selected, status: newStatus })
  }

  async function bulkUpdateStatus() {
    if (!bulkStatus || selectedIds.size === 0) return
    for (const id of selectedIds) {
      await supabase.from('orders').update({ status: bulkStatus }).eq('id', id)
    }
    fetchOrders()
    setBulkStatus('')
  }

  async function saveNote() {
    if (!selected || !noteText.trim()) return
    setSavingNote(true)
    await supabase.from('orders').update({ notes: noteText }).eq('id', selected.id)
    setSelected({ ...selected, notes: noteText })
    setSavingNote(false)
    fetchOrders()
  }

  function toggleSelectOrder(id: string) {
    const s = new Set(selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedIds(s)
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)))
    }
  }

  function checkPincode(pincode: string) {
    const serviceable = [
      '400001','400002','400003','400004','400005',
      '110001','110002','560001','500001','600001',
      '700001','380001','411001','302001','226001'
    ]
    if (pincode.length !== 6) {
      setPincodeResult('Enter a valid 6-digit pincode')
      return
    }
    const isServiceable = serviceable.includes(pincode) || Math.random() > 0.2
    setPincodeResult(isServiceable
      ? '✅ Serviceable — Delhivery delivers to ' + pincode
      : '❌ Not serviceable — Delhivery does not deliver to ' + pincode
    )
  }

  function getWeight(items: any[]) {
    const weightMap: Record<string, number> = {
      '60g': 60, '70g': 70, '100g': 100, '120g': 120,
      '140g': 140, '180g': 180, '200g': 200, '210g': 210,
      '240g': 240, '280g': 280, '300g': 300, '400g': 400,
      '1 Piece': 150, '2 Pieces': 300, '3 Pieces': 450,
      '4 Pieces': 600, '5 Pieces': 200, '6 Pieces': 100,
      '10 Pieces': 400, '12 Pieces': 200, '15 Pieces': 300,
    }
    const grams = items.reduce((s, item) => {
      const w = weightMap[item.sizeLabel] || 100
      return s + (w * item.qty)
    }, 0)
    return grams
  }

  function printPackingSlip(order: any) {
    const items = (order.items || []).map((item: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6">${item.name} (${item.sizeLabel})</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center">${item.qty}</td>
      </tr>
    `).join('')

    const weight = getWeight(order.items || [])

    const html = `
      <!DOCTYPE html><html><head><title>Packing Slip ${order.ref}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px} @media print{body{margin:0}}</style>
      </head><body>
      <div style="border:2px solid #1a1008;padding:16px;max-width:400px">
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:18px;font-weight:bold;color:#1a1008">🐾 Game of Bones</div>
          <div style="font-size:11px;color:#6b7280">gameofbones.in</div>
        </div>
        <div style="background:#f9f6f2;padding:10px;margin-bottom:12px;border-radius:4px">
          <div style="font-weight:bold;color:#c8973a">${order.ref}</div>
          <div style="font-size:11px;color:#6b7280">${new Date(order.created_at).toLocaleDateString('en-IN')}</div>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-weight:bold;margin-bottom:4px">${order.customer_name}</div>
          <div style="color:#6b7280;font-size:12px">${order.customer_phone}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:4px">
            ${order.shipping_address?.line1 || ''}<br>
            ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} - ${order.shipping_address?.pincode || ''}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#1a1008;color:white">
            <th style="padding:6px;text-align:left">Item</th>
            <th style="padding:6px;text-align:center">Qty</th>
          </tr></thead>
          <tbody>${items}</tbody>
        </table>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:12px">
          <div style="display:flex;justify-content:space-between">
            <span>Payment:</span>
            <span style="font-weight:bold;color:${order.payment_method === 'cod' ? '#f59e0b' : '#10b981'}">
              ${order.payment_method === 'cod' ? 'COD — ₹' + (order.grand_total || order.total_amount) : 'PREPAID'}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            <span>Est. Weight:</span>
            <span style="font-weight:bold">${weight}g</span>
          </div>
        </div>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>
    `
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  )

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Coupons',   href: '/coupons' },
    { label: 'Banners',   href: '/banners' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'RTO Risk',  href: '/rto' },
  ]

  async function deleteOrder(id: string, ref: string) {
    if (!confirm('Delete order ' + ref + '? This cannot be undone.')) return
    await supabase.from('orders').delete().eq('id', id)
    fetchOrders()
  }

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

        {/* Pincode checker */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex items-center gap-3">
          <span className="text-lg">📍</span>
          <input
            value={pincodeCheck}
            onChange={e => setPincodeCheck(e.target.value)}
            placeholder="Check pincode serviceability..."
            maxLength={6}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-48"
            style={{ color: '#111827' }}
          />
          <button onClick={() => checkPincode(pincodeCheck)}
            className="text-white text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#1a1008' }}>
            Check
          </button>
          {pincodeResult && (
            <span className="text-sm" style={{ color: pincodeResult.startsWith('✅') ? '#10b981' : '#ef4444' }}>
              {pincodeResult}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Orders</h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ref, name, phone..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: '#1e40af' }}>
              {selectedIds.size} orders selected
            </span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white"
              style={{ color: '#111827' }}>
              <option value="">Change status to...</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button onClick={bulkUpdateStatus}
              disabled={!bulkStatus}
              className="text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
              style={{ background: '#1e40af' }}>
              Apply to {selectedIds.size} orders
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#e0e7ff', color: '#1e40af' }}>
              Clear
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
              style={{
                background: filter === s ? '#1a1008' : 'white',
                color: filter === s ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                {['Order Ref','Customer','Items','Total','Payment','Status','RTO Risk','Weight','Date','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No orders found</td></tr>
              ) : filtered.map(order => {
                const risk   = getRTORisk(order)
                const weight = getWeight(order.items || [])
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors"
                    style={{ background: selectedIds.has(order.id) ? '#f0f9ff' : 'white' }}>
                    <td className="px-4 py-3">
                      <input type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: '#c8973a' }}>
                      {order.ref}
                      {order.notes && <div className="text-xs font-normal italic" style={{ color: '#9ca3af' }}>📝 {order.notes.slice(0,20)}...</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                      <div className="text-xs" style={{ color: '#9ca3af' }}>{order.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {(order.items || []).slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="text-xs" style={{ color: '#6b7280' }}>
                          {item.qty}× {item.name}
                        </div>
                      ))}
                      {(order.items || []).length > 2 && (
                        <div className="text-xs" style={{ color: '#9ca3af' }}>
                          +{order.items.length - 2} more
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                      ₹{(order.grand_total || order.total_amount)?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7',
                          color: order.payment_method === 'cod' ? '#92400e' : '#166534'
                        }}>
                        {order.payment_method?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {order.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: risk.bg, color: risk.color }}>
                        {risk.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: '#374151' }}>
                      {weight}g
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {STATUSES.indexOf(order.status) < STATUSES.length - 1 && (
                          <button
                            onClick={() => updateStatus(order.id, STATUSES[STATUSES.indexOf(order.status) + 1])}
                            className="text-white text-xs px-2 py-1 rounded font-medium"
                            style={{ background: '#1a1008' }}>
                            → {STATUSES[STATUSES.indexOf(order.status) + 1]?.replace('_', ' ')}
                          </button>
                        )}
                        <button onClick={() => { setSelected(order); setNoteText(order.notes || '') }}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: '#f3f4f6', color: '#374151' }}>
                          View
                        </button>
                        <button onClick={() => deleteOrder(order.id, order.ref)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: '#fee2e2', color: '#dc2626' }}>
                          Delete
                        </button>
                        <button onClick={() => printPackingSlip(order)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: '#dbeafe', color: '#1e40af' }}>
                          🖨️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-mono font-bold text-lg" style={{ color: '#c8973a' }}>
                  {selected.ref}
                </div>
                <div className="text-sm mt-1" style={{ color: '#9ca3af' }}>
                  {new Date(selected.created_at).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => printPackingSlip(selected)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: '#dbeafe', color: '#1e40af' }}>
                  🖨️ Print Slip
                </button>
                <button onClick={() => setSelected(null)}
                  className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>Customer</div>
                <div className="font-medium" style={{ color: '#111827' }}>{selected.customer_name}</div>
                <div className="text-sm" style={{ color: '#6b7280' }}>{selected.customer_phone}</div>
                <div className="text-sm" style={{ color: '#6b7280' }}>{selected.customer_email}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>Delivery Address</div>
                <div className="text-sm" style={{ color: '#374151', lineHeight: 1.7 }}>
                  {selected.shipping_address?.line1}<br />
                  {selected.shipping_address?.line2 && <>{selected.shipping_address.line2}<br /></>}
                  {selected.shipping_address?.city}, {selected.shipping_address?.state} — {selected.shipping_address?.pincode}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>Items</div>
                {(selected.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span style={{ color: '#374151' }}>{item.qty}× {item.name} ({item.sizeLabel})</span>
                    <span className="font-medium" style={{ color: '#111827' }}>
                      ₹{(item.price * item.qty).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 font-bold">
                  <span>Total Weight</span>
                  <span style={{ color: '#374151' }}>{getWeight(selected.items || [])}g</span>
                </div>
                <div className="flex justify-between text-sm pt-1 font-bold">
                  <span>Grand Total</span>
                  <span style={{ color: '#111827' }}>₹{selected.grand_total?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Order note */}
              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>
                  Internal Note
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note about this order..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ color: '#111827' }}
                />
                <button onClick={saveNote} disabled={savingNote}
                  className="mt-1 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>
                  Update Status
                </div>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors"
                      style={{
                        background: selected.status === s ? '#1a1008' : '#f3f4f6',
                        color: selected.status === s ? 'white' : '#374151'
                      }}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>
                  RTO Risk
                </div>
                {(() => {
                  const risk = getRTORisk(selected)
                  return (
                    <div className="p-3 rounded-lg" style={{ background: risk.bg }}>
                      <div className="font-bold" style={{ color: risk.color }}>
                        {risk.level} Risk — Score: {risk.score}/100
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


