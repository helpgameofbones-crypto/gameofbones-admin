'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUSES = ['placed','confirmed','packed','labelled','pickup_ready','dispatched','delivered','rto']

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [noteText, setNoteText] = useState('')
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
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    fetchOrders()
    if (selected?.id === orderId) setSelected({ ...selected, status: newStatus })
  }

  async function deleteOrder(orderId: string, ref: string) {
    if (!confirm(`Delete order ${ref}? This cannot be undone.`)) return
    await supabase.from('orders').delete().eq('id', orderId)
    setSelected(null)
    fetchOrders()
  }

  function printPackingSlip(order: any) {
    const items = (order.items || []).map((item: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6">${item.name}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity || item.qty || 1}</td>
      </tr>
    `).join('')

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
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#1a1008;color:white">
            <th style="padding:6px;text-align:left">Item</th>
            <th style="padding:6px;text-align:center">Qty</th>
          </tr></thead>
          <tbody>${items}</tbody>
        </table>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:12px">
          <div style="display:flex;justify-content:space-between;font-weight:bold">
            <span>Total:</span>
            <span>₹${(order.grand_total || order.total_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>
    `
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  async function saveNote() {
    if (!selected || !noteText.trim()) return
    setSavingNote(true)
    await supabase.from('orders').update({ notes: noteText }).eq('id', selected.id)
    setSelected({ ...selected, notes: noteText })
    setSavingNote(false)
    fetchOrders()
  }

  function checkPincode(pincode: string) {
    const serviceable = ['400001','400002','110001','560001','500001','600001','700001','380001']
    if (pincode.length !== 6) {
      setPincodeResult('Enter a valid 6-digit pincode')
      return
    }
    const isServiceable = serviceable.includes(pincode)
    setPincodeResult(isServiceable ? '✅ Serviceable' : '❌ Not serviceable')
  }

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  )

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '24px' }}>Orders</h1>

      <div style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', marginBottom: '24px', borderRadius: '4px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '18px' }}>📍</span>
        <input type="text" value={pincodeCheck} onChange={e => setPincodeCheck(e.target.value)} placeholder="Check pincode..." maxLength={6} style={{ padding: '10px', border: '1px solid #ede5d8', width: '160px', fontSize: '14px' }} />
        <button onClick={() => checkPincode(pincodeCheck)} style={{ padding: '10px 16px', background: '#1a1008', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Check</button>
        {pincodeResult && <span style={{ fontSize: '13px', color: pincodeResult.startsWith('✅') ? '#2a7c6f' : '#c0392b' }}>{pincodeResult}</span>}
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '8px 16px', background: filter === s ? '#1a1008' : '#fff', color: filter === s ? '#fff' : '#1a1008', border: '1px solid #ede5d8', cursor: 'pointer', fontSize: '12px', fontWeight: '600', borderRadius: '4px', textTransform: 'capitalize' }}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref, name, phone..." style={{ padding: '10px 16px', border: '1px solid #ede5d8', width: '300px', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p>No orders found</p>
        ) : (
          filtered.map(order => (
            <div key={order.id} onClick={() => { setSelected(order); setNoteText(order.notes || ''); }} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', borderRadius: '4px', cursor: 'pointer', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>REF</p><p style={{ color: '#c8973a', fontWeight: '600' }}>{order.ref}</p></div>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>CUSTOMER</p><p style={{ color: '#1a1008' }}>{order.customer_name}</p><p style={{ fontSize: '12px', color: '#7a6a5a' }}>{order.customer_phone}</p></div>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>ITEMS</p><p style={{ color: '#1a1008' }}>{(order.items || []).length} items</p></div>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>TOTAL</p><p style={{ color: '#c8973a', fontWeight: '600' }}>₹{(order.grand_total || order.total_amount || 0).toFixed(2)}</p></div>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>PAYMENT</p><p style={{ color: '#1a1008', textTransform: 'uppercase', fontSize: '12px', fontWeight: '600' }}>{order.payment_method || 'cod'}</p></div>
              <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>STATUS</p><p style={{ color: order.status === 'confirmed' ? '#2a7c6f' : '#666', textTransform: 'capitalize', fontWeight: '600' }}>{order.status || 'pending'}</p></div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', color: '#1a1008', margin: 0 }}>{selected.ref}</h2>
              <button onClick={() => setSelected(null)} style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>Customer</p>
              <p style={{ color: '#1a1008', fontWeight: '600', margin: 0 }}>{selected.customer_name}</p>
              <p style={{ color: '#7a6a5a', margin: '4px 0 0 0' }}>{selected.customer_phone}</p>
              {selected.customer_email && <p style={{ color: '#7a6a5a', margin: '4px 0 0 0' }}>{selected.customer_email}</p>}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>Items</p>
              {(selected.items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ede5d8' }}>
                  <span style={{ color: '#1a1008' }}>{(item.quantity || item.qty || 1)}× {item.name}</span>
                  <span style={{ color: '#c8973a', fontWeight: '600' }}>₹{((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid #ede5d8', paddingTop: '16px', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Total</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#c8973a', margin: 0 }}>₹{(selected.grand_total || selected.total_amount || 0).toFixed(2)}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>Internal Note</p>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '13px', fontFamily: 'inherit', color: '#1a1008' }} />
              <button onClick={saveNote} disabled={savingNote} style={{ marginTop: '8px', padding: '10px 16px', background: '#1a1008', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', opacity: savingNote ? 0.6 : 1 }}>
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>

            <div>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>Update Status</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} style={{ padding: '8px 12px', background: selected.status === s ? '#1a1008' : '#f3f4f6', color: selected.status === s ? '#fff' : '#1a1008', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', borderRadius: '4px', textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
