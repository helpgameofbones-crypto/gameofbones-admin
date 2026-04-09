'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  const deleteOrder = async (id: string, ref: string) => {
    if (!confirm(`Delete order ${ref}?`)) return;
    await supabase.from('orders').delete().eq('id', id);
    setSelected(null);
    fetchOrders();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setSelected({ ...selected, status });
    fetchOrders();
  };

  const printSlip = (order: any) => {
    const itemsHtml = (order.items || []).map((item: any) => `<tr><td>${item.name}</td><td>${item.quantity || 1}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>Game of Bones - Packing Slip</h2><p><b>${order.ref}</b></p><p>${order.customer_name}<br>${order.customer_phone}</p><table border="1" style="width:100%;margin:20px 0"><tr><th>Item</th><th>Qty</th></tr>${itemsHtml}</table><p><b>Total: ₹${(order.grand_total || order.total_amount || 0).toFixed(2)}</b></p><script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const filtered = orders.filter(o =>
    o.ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  );

  const STATUSES = ['placed', 'confirmed', 'packed', 'labelled', 'pickup_ready', 'dispatched', 'delivered', 'rto'];

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '24px' }}>Orders</h1>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['all', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '8px 16px', background: filter === s ? '#1a1008' : '#fff', color: filter === s ? '#fff' : '#1a1008', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref, name, phone..." style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '2px solid #ddd', fontSize: '14px', color: '#1a1008', fontWeight: '600' }} />

      <div style={{ display: 'grid', gap: '12px' }}>
        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p>No orders found</p>
        ) : (
          filtered.map(order => (
            <div key={order.id} onClick={() => setSelected(order)} style={{ background: '#fff', border: '1px solid #ddd', padding: '16px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>REF</p><p style={{ color: '#c8973a', fontWeight: '600', margin: '4px 0 0 0' }}>{order.ref}</p></div>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>CUSTOMER</p><p style={{ color: '#1a1008', margin: '4px 0 0 0' }}>{order.customer_name}</p></div>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>ITEMS</p><p style={{ color: '#1a1008', margin: '4px 0 0 0' }}>{(order.items || []).length}</p></div>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>TOTAL</p><p style={{ color: '#c8973a', fontWeight: '600', margin: '4px 0 0 0' }}>₹{(order.grand_total || order.total_amount || 0).toFixed(2)}</p></div>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>PAYMENT</p><p style={{ color: '#1a1008', margin: '4px 0 0 0', textTransform: 'uppercase' }}>{order.payment_method}</p></div>
              <div><p style={{ fontSize: '11px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>STATUS</p><p style={{ color: '#1a1008', margin: '4px 0 0 0', textTransform: 'capitalize' }}>{order.status}</p></div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', maxWidth: '700px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#1a1008', margin: 0 }}>{selected.ref}</h2>
              <button onClick={() => setSelected(null)} style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#2a1f1a', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Customer</p>
              <p style={{ color: '#1a1008', fontWeight: '600', margin: 0 }}>{selected.customer_name}</p>
              <p style={{ color: '#2a1f1a', margin: '4px 0 0 0' }}>{selected.customer_phone}</p>
              {selected.customer_email && <p style={{ color: '#2a1f1a', margin: '4px 0 0 0' }}>{selected.customer_email}</p>}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#2a1f1a', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Items</p>
              {(selected.items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee', color: '#1a1008' }}>
                  <span>{(item.quantity || item.qty || 1)}× {item.name}</span>
                  <span style={{ fontWeight: '600' }}>₹{((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid #eee', paddingTop: '16px', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#2a1f1a', fontWeight: '600', margin: 0 }}>TOTAL</p>
              <p style={{ fontSize: '28px', fontWeight: '700', color: '#c8973a', margin: '8px 0 0 0' }}>₹{(selected.grand_total || selected.total_amount || 0).toFixed(2)}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#2a1f1a', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Change Status</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} style={{ padding: '8px 12px', background: selected.status === s ? '#1a1008' : '#f0f0f0', color: selected.status === s ? '#fff' : '#1a1008', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => printSlip(selected)} style={{ flex: 1, padding: '12px', background: '#dbeafe', color: '#1e40af', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                🖨️ Print Slip
              </button>
              <button onClick={() => deleteOrder(selected.id, selected.ref)} style={{ flex: 1, padding: '12px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}