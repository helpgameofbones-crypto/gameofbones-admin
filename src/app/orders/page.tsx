'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  )

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '24px' }}>Orders</h1>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by ref, name, phone..."
        style={{ padding: '10px 16px', border: '1px solid #ede5d8', width: '300px', marginBottom: '24px', fontSize: '14px' }}
      />

      <div style={{ display: 'grid', gap: '12px' }}>
        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p>No orders found</p>
        ) : (
          filtered.map(order => (
            <div key={order.id} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setSelected(order)}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>ORDER REF</p><p style={{ color: '#1a1008', fontWeight: '600' }}>{order.ref}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>CUSTOMER</p><p style={{ color: '#1a1008' }}>{order.customer_name}</p><p style={{ fontSize: '12px', color: '#7a6a5a' }}>{order.customer_phone}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>ITEMS</p><p style={{ color: '#1a1008' }}>{(order.items || []).length} items</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>TOTAL</p><p style={{ color: '#c8973a', fontWeight: '600' }}>₹{(order.grand_total || order.total_amount || 0).toFixed(2)}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>STATUS</p><p style={{ color: order.status === 'confirmed' ? '#2a7c6f' : '#666' }}>{order.status || 'pending'}</p></div>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
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

            <div style={{ borderTop: '2px solid #ede5d8', paddingTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Total</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#c8973a', margin: 0 }}>₹{(selected.grand_total || selected.total_amount || 0).toFixed(2)}</p>
            </div>

            {selected.notes && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#faf6f0', borderRadius: '4px' }}>
                <p style={{ fontSize: '12px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Notes</p>
                <p style={{ color: '#1a1008', margin: 0 }}>{selected.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}