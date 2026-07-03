'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

interface Order {
  id: string; ref: string; status: string; customer_name: string; customer_phone: string;
  customer_email: string; items: any; grand_total: number; total_amount: number;
  payment_method: string; shipping_address: any; delhivery_awb: string;
  coupon_code: string; created_at: string; estimated_delivery: string;
}

const STATUS_COLORS: Record<string, string> = {
  placed: '#f59e0b', confirmed: '#3b82f6', dispatched: '#8b5cf6',
  shipped: '#8b5cf6', out_for_delivery: '#06b6d4', delivered: '#16a34a',
  cancelled: '#ef4444', returned: '#dc2626'
};

function parseItems(items: any): string[] {
  if (!items) return [];
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { return [items]; } }
  if (Array.isArray(items)) {
    return items.map((it: any) => {
      if (typeof it === 'string') return it;
      if (it.name) return `${it.name}${it.sizeLabel ? ' (' + it.sizeLabel + ')' : ''}${it.qty > 1 ? ' x' + it.qty : ''}`;
      if (it.product_name) return `${it.product_name}${it.quantity > 1 ? ' x' + it.quantity : ''}`;
      if (it.product) return it.product;
      return JSON.stringify(it);
    });
  }
  if (typeof items === 'object') return Object.entries(items).map(([k, v]) => `${k}: ${v}`);
  return [String(items)];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('confirmed');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setOrders(data);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (o.ref || '').toLowerCase().includes(s) ||
        (o.customer_name || '').toLowerCase().includes(s) ||
        (o.customer_phone || '').includes(s) ||
        (o.delhivery_awb || '').includes(s);
    }
    return true;
  });

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Bulk selection helpers ──────────────────────
  function toggleOne(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map(o => o.id);
    const allChecked = visibleIds.every(id => checkedIds.has(id));
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setCheckedIds(new Set());
  }

  async function applyBulkStatus() {
    if (checkedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(checkedIds);
    const { error } = await supabase.from('orders').update({ status: bulkStatus }).in('id', ids);
    setBulkBusy(false);
    if (error) { alert('Bulk update failed: ' + error.message); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: bulkStatus } : o));
    clearSelection();
  }

  async function bulkExportCsv() {
    const ids = Array.from(checkedIds);
    const rows = orders.filter(o => ids.includes(o.id));
    if (rows.length === 0) return;
    const header = ['Ref', 'Customer', 'Phone', 'Amount', 'Status', 'Date'];
    const csvRows = rows.map(o => [
      o.ref, o.customer_name || '', o.customer_phone || '',
      (o.grand_total || o.total_amount || 0).toString(), o.status,
      new Date(o.created_at).toLocaleDateString('en-IN')
    ]);
    const csv = [header, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allVisibleChecked = filtered.length > 0 && filtered.every(o => checkedIds.has(o.id));
  const someVisibleChecked = filtered.some(o => checkedIds.has(o.id));

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Orders</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{orders.length} total orders</p>
        </div>
        <button onClick={fetchOrders} style={{ padding: '8px 16px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'placed', 'confirmed', 'dispatched', 'shipped', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              background: filter === s ? '#1a1008' : '#f3f4f6', color: filter === s ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4, cursor: 'pointer', letterSpacing: '.05em' }}>
            {s} {statusCounts[s] ? `(${statusCounts[s]})` : s === 'all' ? `(${orders.length})` : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref, name, phone, AWB..."
        style={{ width: '100%', maxWidth: 400, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, marginBottom: 16 }} />

      {/* Bulk action bar - only shows when items are selected */}
      {checkedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1a1008', color: '#fff', padding: '12px 16px', borderRadius: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{checkedIds.size} selected</span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Set status to:</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600 }}>
            {['placed', 'confirmed', 'dispatched', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'].map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
          <button onClick={applyBulkStatus} disabled={bulkBusy}
            style={{ padding: '6px 16px', background: '#c8973a', color: '#fff', border: 'none', borderRadius: 4, cursor: bulkBusy ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            {bulkBusy ? 'Applying...' : 'Apply'}
          </button>
          <button onClick={bulkExportCsv}
            style={{ padding: '6px 16px', background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            📥 Export CSV
          </button>
          <button onClick={clearSelection}
            style={{ marginLeft: 'auto', padding: '6px 16px', background: 'none', color: 'rgba(255,255,255,.7)', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            ✕ Clear
          </button>
        </div>
      )}

      {loading ? <p>Loading orders...</p> : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Orders list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: 36 }}>
                    <input type="checkbox" checked={allVisibleChecked} ref={el => { if (el) el.indeterminate = someVisibleChecked && !allVisibleChecked; }} onChange={toggleAllVisible} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Order</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Items</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const items = parseItems(o.items);
                  const isChecked = checkedIds.has(o.id);
                  return (
                    <tr key={o.id}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: isChecked ? '#fff9f0' : selected?.id === o.id ? '#fffbeb' : '' }}>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleOne(o.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                      </td>
                      <td style={{ padding: '12px' }} onClick={() => setSelected(o)}>
                        <div style={{ fontWeight: 700, color: '#1a1008' }}>{o.ref}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{o.payment_method || 'online'}</div>
                      </td>
                      <td style={{ padding: '12px' }} onClick={() => setSelected(o)}>
                        <div style={{ fontWeight: 600 }}>{o.customer_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{o.customer_phone}</div>
                      </td>
                      <td style={{ padding: '12px', maxWidth: 250 }} onClick={() => setSelected(o)}>
                        {items.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {items.slice(0, 3).map((item, i) => (
                              <span key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>• {item}</span>
                            ))}
                            {items.length > 3 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{items.length - 3} more</span>}
                          </div>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }} onClick={() => setSelected(o)}>
                        ₹{(o.grand_total || o.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }} onClick={() => setSelected(o)}>
                        <span style={{ background: (STATUS_COLORS[o.status] || '#6b7280') + '18',
                          color: STATUS_COLORS[o.status] || '#6b7280',
                          fontSize: 10, fontWeight: 700, padding: '3px 10px', textTransform: 'uppercase',
                          letterSpacing: '.06em', borderRadius: 20 }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }} onClick={() => setSelected(o)}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Order detail panel */}
          {selected && (
            <div style={{ width: 380, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Order #{selected.ref}</h3>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '.08em' }}>Status</label>
                <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, marginTop: 4, cursor: 'pointer' }}>
                  {['placed', 'confirmed', 'dispatched', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'].map(s => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: '#f9fafb', padding: 14, borderRadius: 6, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Customer</div>
                <div style={{ fontWeight: 600 }}>{selected.customer_name}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>📱 {selected.customer_phone}</div>
                {selected.customer_email && <div style={{ fontSize: 13, color: '#6b7280' }}>📧 {selected.customer_email}</div>}
              </div>

              <div style={{ background: '#f9fafb', padding: 14, borderRadius: 6, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Items Ordered</div>
                {parseItems(selected.items).map((item, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🦴</span>
                    <span style={{ fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Total</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>₹{(selected.grand_total || selected.total_amount || 0).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Payment</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{(selected.payment_method || 'online').toUpperCase()}</div>
                </div>
              </div>

              {selected.delhivery_awb && (
                <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6, marginBottom: 12, border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#0284c7' }}>Delhivery AWB</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selected.delhivery_awb}</div>
                  <a href={`https://www.delhivery.com/track/package/${selected.delhivery_awb}`} target="_blank" rel="noopener"
                    style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}>Track on Delhivery →</a>
                </div>
              )}

              {selected.coupon_code && (
                <div style={{ fontSize: 12, color: '#c8973a', marginBottom: 12 }}>🏷️ Coupon: {selected.coupon_code}</div>
              )}

              {selected.shipping_address && (
                <div style={{ background: '#f9fafb', padding: 14, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Shipping Address</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {typeof selected.shipping_address === 'string' ? selected.shipping_address :
                      Object.values(selected.shipping_address).filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
