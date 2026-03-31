'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Download, FileText, Calendar, Loader } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function BulkInvoicesPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [progress, setProgress] = useState(0)

  useEffect(() => { fetchOrders() }, [dateFrom, dateTo, statusFilter])

  async function fetchOrders() {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('id, order_number, ref, customer_name, customer_email, customer_phone, shipping_address, items, grand_total, total_amount, payment_method, status, created_at')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  function generateInvoiceHTML(order: any) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || []
    const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address || {}
    const total = order.grand_total || order.total_amount || 0
    const invoiceNum = 'GOB-' + (order.ref || order.order_number || order.id.slice(0, 8).toUpperCase())
    const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #c8973a; padding-bottom: 20px; }
  .brand { font-size: 22px; font-weight: bold; color: #1a1008; }
  .tagline { font-size: 11px; color: #888; margin-top: 2px; }
  .invoice-title { font-size: 28px; font-weight: bold; color: #c8973a; }
  .invoice-meta { font-size: 12px; color: #666; text-align: right; margin-top: 4px; }
  .section { margin: 20px 0; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
  .address { font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #1a1008; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .total-row { font-weight: bold; font-size: 15px; background: #fef9f0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
  .badge { display: inline-block; background: ${order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7'}; color: ${order.payment_method === 'cod' ? '#92400e' : '#166534'}; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">🐾 Game of Bones</div>
    <div class="tagline">Premium Natural Dehydrated Treats for Happy Dogs</div>
    <div class="tagline">gameofbones.in · support@gameofbones.in</div>
  </div>
  <div>
    <div class="invoice-title">INVOICE</div>
    <div class="invoice-meta">${invoiceNum}<br>${date}</div>
  </div>
</div>

<div style="display:flex; gap:40px;">
  <div class="section" style="flex:1">
    <div class="section-title">Bill To</div>
    <div class="address">
      <strong>${order.customer_name}</strong><br>
      ${order.customer_phone}<br>
      ${order.customer_email || ''}
    </div>
  </div>
  <div class="section" style="flex:1">
    <div class="section-title">Ship To</div>
    <div class="address">
      ${addr.line1 || ''}<br>
      ${addr.city || ''}, ${addr.state || ''}<br>
      PIN: ${addr.pincode || ''}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Payment</div>
    <div class="badge">${(order.payment_method || 'prepaid').toUpperCase()}</div>
    <div style="font-size:12px;color:#666;margin-top:6px;">Status: ${order.status}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Item</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Price</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((item: any) => `
    <tr>
      <td>${item.name || item.product_name || 'Product'}</td>
      <td style="text-align:center">${item.quantity || 1}</td>
      <td style="text-align:right">₹${(item.price || 0).toLocaleString('en-IN')}</td>
      <td style="text-align:right">₹${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="3" style="text-align:right">Total Amount</td>
      <td style="text-align:right; color:#c8973a">₹${total.toLocaleString('en-IN')}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  Thank you for choosing Game of Bones! 🐾<br>
  For support: support@gameofbones.in<br>
  This is a computer-generated invoice.
</div>
</body>
</html>`
  }

  async function downloadAll() {
    if (orders.length === 0) return
    setGenerating(true)
    setProgress(0)

    try {
      // Dynamically import JSZip
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folder = zip.folder('Game_of_Bones_Invoices')!

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i]
        const html = generateInvoiceHTML(order)
        const filename = `Invoice_${order.ref || order.order_number || order.id.slice(0, 8)}_${order.customer_name?.replace(/\s+/g, '_')}.html`
        folder.file(filename, html)
        setProgress(Math.round(((i + 1) / orders.length) * 100))
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `GameOfBones_Invoices_${dateFrom}_to_${dateTo}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('ZIP generation failed:', err)
      alert('ZIP generation failed. Please try downloading individually.')
    }

    setGenerating(false)
    setProgress(0)
  }

  function downloadSingle(order: any) {
    const html = generateInvoiceHTML(order)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Invoice_${order.ref || order.order_number}.html`
    a.click()
  }

  const totalValue = orders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Invoice Download</h1>
          <p className="text-sm text-gray-500 mt-1">Download all invoices for a date range as a ZIP file</p>
        </div>
        <button onClick={downloadAll} disabled={orders.length === 0 || generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">
          {generating ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
          {generating ? `Generating ${progress}%...` : `Download ${orders.length} Invoices as ZIP`}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="dispatched">Dispatched</option>
              <option value="confirmed">Confirmed</option>
              <option value="placed">Placed</option>
            </select>
          </div>
          <div className="flex gap-2">
            {['This Month', 'Last Month', 'Last 7 Days'].map(preset => (
              <button key={preset} onClick={() => {
                const now = new Date()
                if (preset === 'This Month') {
                  setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
                  setDateTo(now.toISOString().split('T')[0])
                } else if (preset === 'Last Month') {
                  setDateFrom(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0])
                  setDateTo(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0])
                } else {
                  setDateFrom(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
                  setDateTo(now.toISOString().split('T')[0])
                }
              }}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-700">{orders.length}</div>
          <div className="text-xs font-medium text-blue-600 mt-1">Invoices in Range</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-700">₹{totalValue.toLocaleString('en-IN')}</div>
          <div className="text-xs font-medium text-green-600 mt-1">Total Value</div>
        </div>
      </div>

      {/* Order List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No orders in this date range</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Order', 'Customer', 'Date', 'Amount', 'Status', 'Download'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-orange-600 text-xs">
                    #{order.ref || order.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">{order.customer_name}</div>
                    <div className="text-xs text-gray-400">{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    ₹{(order.grand_total || order.total_amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => downloadSingle(order)}
                      className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium">
                      <Download size={12} /> HTML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}