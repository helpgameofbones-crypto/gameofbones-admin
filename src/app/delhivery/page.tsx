'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Same XOR/base64 scheme as the website's encryptData() — customer_phone is
// stored encrypted, so it must be decrypted before it's shown on screen.
// TODO(security): this is a reversible XOR+base64 obfuscation, not real encryption, and the
// key is hardcoded and shipped to client bundles — it provides no real protection. Replace with
// server-side AES-256-GCM (key from a secrets manager, never sent to the browser) and run a
// data migration for existing rows. Not safe to change here without DB access to migrate data.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan'
function decryptData(encrypted: string): string {
  if (!encrypted) return ''
  try {
    const binary = atob(encrypted)
    let result = ''
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return encrypted
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return ''
  if (/^\+?\d{10,13}$/.test(raw)) return raw
  const dec = decryptData(raw)
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw
}

// Order items are saved with a `quantity` key, not `qty` — reading `.qty`
// silently returns undefined and turns every weight sum into NaN.
function itemQty(i: any): number {
  return i?.quantity ?? i?.qty ?? 1
}

export default function DelhiveryPage() {
  const [orders, setOrders]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [tracking, setTracking]     = useState<any>(null)
  const [trackingAwb, setTrackingAwb] = useState('')
  const [pincodeCheck, setPincodeCheck] = useState('')
  const [pincodeResult, setPincodeResult] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [msg, setMsg]               = useState('')
  const [tab, setTab]               = useState('pending')

  useEffect(() => { fetchOrders() }, [tab])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false })

    if (tab === 'pending') {
      q = q.in('status', ['confirmed', 'packed']).is('delhivery_awb', null)
    } else if (tab === 'dispatched') {
      q = q.not('delhivery_awb', 'is', null)
    }

    const { data } = await q.limit(100)
    setOrders(data || [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  async function generateAWB(order: any) {
    setGenerating(order.id)
    setMsg('')
    try {
      const res = await fetch('/api/delhivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'create_shipment',
          orderId:   order.id,
          orderData: order,
        })
      })
      const data = await res.json()
      if (data.ok) {
        setMsg(` AWB ${data.awb} generated for ${order.ref}`)
        fetchOrders()
      } else {
        setMsg(' ' + (data.error || 'Failed to generate AWB'))
      }
    } catch (e) {
      setMsg(' Network error')
    }
    setGenerating(null)
    setTimeout(() => setMsg(''), 5000)
  }

  async function bulkGenerateAWB() {
    setBulkGenerating(true)
    const toGenerate = orders.filter(o => selectedIds.has(o.id))
    let success = 0
    for (const order of toGenerate) {
      try {
        const res = await fetch('/api/delhivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:    'create_shipment',
            orderId:   order.id,
            orderData: order,
          })
        })
        const data = await res.json()
        if (data.ok) success++
      } catch {}
    }
    setBulkGenerating(false)
    setMsg(` Generated ${success}/${toGenerate.length} AWBs`)
    setSelectedIds(new Set())
    fetchOrders()
    setTimeout(() => setMsg(''), 5000)
  }

  async function trackShipment(awb: string) {
    try {
      const res = await fetch('/api/delhivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'track', orderData: { awb } })
      })
      const data = await res.json()
      setTracking(data.tracking)
    } catch {
      setMsg(' Tracking failed')
    }
  }

  async function checkPincode(pincode: string) {
    try {
      const res = await fetch('/api/delhivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_pincode', orderData: { pincode } })
      })
      const data = await res.json()
      setPincodeResult(data)
    } catch {
      setPincodeResult({ serviceable: false })
    }
  }

  function toggleSelect(id: string) {
    const s = new Set(selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedIds(s)
  }

  function selectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.filter(o => !o.delhivery_awb).map(o => o.id)))
    }
  }

  const navLinks = [
    { label: 'Dashboard',  href: '/dashboard' },
    { label: 'Orders',     href: '/orders' },
    { label: 'Delhivery',  href: '/delhivery' },
    { label: 'Inventory',  href: '/inventory' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Delhivery</h1>
          <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
            Generate AWB labels, track shipments, check pincodes
          </p>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        {/* Pincode checker */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6 flex items-center gap-3 flex-wrap">
          <span className="font-medium text-sm" style={{ color: '#1a1008' }}> Check Pincode</span>
          <input value={pincodeCheck} onChange={e => setPincodeCheck(e.target.value)}
            placeholder="Enter 6-digit pincode..."
            maxLength={6}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-40"
            style={{ color: '#111827' }}
          />
          <button onClick={() => checkPincode(pincodeCheck)}
            className="text-white text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#1a1008' }}>
            Check
          </button>
          {pincodeResult && (
            <span className="text-sm font-medium"
              style={{ color: pincodeResult.serviceable ? '#10b981' : '#ef4444' }}>
              {pincodeResult.serviceable ? ' Serviceable' : ' Not serviceable'}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'pending',    label: 'Needs AWB' },
            { key: 'dispatched', label: 'Dispatched' },
            { key: 'all',        label: 'All Orders' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tab === t.key ? '#1a1008' : 'white',
                color: tab === t.key ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: '#1e40af' }}>
              {selectedIds.size} orders selected
            </span>
            <button onClick={bulkGenerateAWB} disabled={bulkGenerating}
              className="text-white text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
              style={{ background: '#1e40af' }}>
              {bulkGenerating ? 'Generating...' : `Generate ${selectedIds.size} AWBs`}
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#e0e7ff', color: '#1e40af' }}>
              Clear
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selectedIds.size === orders.filter(o => !o.delhivery_awb).length && orders.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                {['Order','Customer','Address','Weight','Payment','AWB','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                  No orders found
                </td></tr>
              ) : orders.map(order => {
                const weight = (order.items || []).reduce((s: number, i: any) => s + ((i.weight_grams || 100) * itemQty(i)), 0)
                return (
                  <tr key={order.id} className="hover:bg-gray-50"
                    style={{ background: selectedIds.has(order.id) ? '#f0f9ff' : 'white' }}>
                    <td className="px-4 py-3">
                      {!order.delhivery_awb && (
                        <input type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold" style={{ color: '#c8973a' }}>{order.ref}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>
                        {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#111827' }}>{order.customer_name}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>{decryptPhone(order.customer_phone)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                      {order.shipping_address?.city}, {order.shipping_address?.state}<br />
                      <span className="font-mono">{order.shipping_address?.pincode}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: '#1a1008' }}>
                      {weight}g
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7',
                          color: order.payment_method === 'cod' ? '#92400e' : '#166534'
                        }}>
                        {order.payment_method?.toUpperCase()}
                        {order.payment_method === 'cod' ? ` ${order.grand_total}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.delhivery_awb ? (
                        <div>
                          <div className="font-mono text-xs font-bold" style={{ color: '#1a1008' }}>
                            {order.delhivery_awb}
                          </div>
                          <a href={`https://www.delhivery.com/track/package/${order.delhivery_awb}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs" style={{ color: '#3b82f6' }}>
                            Track 
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: '#2a1f1a', fontSize: 12 }}>Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!order.delhivery_awb ? (
                        <button
                          onClick={() => generateAWB(order)}
                          disabled={generating === order.id}
                          className="text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                          style={{ background: '#c8973a' }}>
                          {generating === order.id ? 'Generating...' : ' Generate AWB'}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setTrackingAwb(order.delhivery_awb); trackShipment(order.delhivery_awb) }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: '#dbeafe', color: '#1e40af' }}>
                           Track
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Tracking Modal */}
        {tracking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg" style={{ color: '#111827' }}>Tracking</div>
                  <div className="font-mono text-sm" style={{ color: '#c8973a' }}>{trackingAwb}</div>
                </div>
                <button onClick={() => setTracking(null)}
                  className="text-2xl font-light" style={{ color: '#2a1f1a' }}></button>
              </div>
              <div className="p-6">
                {tracking.ShipmentData?.[0]?.Shipment ? (
                  <div>
                    <div className="mb-4 p-3 rounded-lg" style={{ background: '#f9fafb' }}>
                      <div className="text-sm font-medium" style={{ color: '#111827' }}>
                        Status: {tracking.ShipmentData[0].Shipment.Status?.Status}
                      </div>
                      <div className="text-xs mt-1" style={{ color: '#1a1008' }}>
                        {tracking.ShipmentData[0].Shipment.Status?.StatusDateTime}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(tracking.ShipmentData[0].Shipment.Scans || []).slice(0, 10).map((scan: any, i: number) => (
                        <div key={i} className="flex gap-3 text-xs">
                          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: i === 0 ? '#10b981' : '#d1d5db' }} />
                          <div>
                            <div className="font-medium" style={{ color: '#1a1008' }}>
                              {scan.ScanDetail?.Scan}
                            </div>
                            <div style={{ color: '#2a1f1a' }}>
                              {scan.ScanDetail?.ScannedLocation}  {scan.ScanDetail?.ScanDateTime}
                        
