'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

interface ProductPerf {
  name: string; category: string; totalOrders: number; totalRevenue: number;
  avgOrderValue: number; lastOrdered: string; returnRate: number;
}

export default function ProductPerformancePage() {
  const [products, setProducts] = useState<ProductPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'totalRevenue' | 'totalOrders'>('totalRevenue');

  useEffect(() => { fetchPerformance(); }, []);

  async function fetchPerformance() {
    setLoading(true);
    const { data: orders } = await supabase.from('orders').select('items,grand_total,total_amount,status,created_at').neq('status', 'cancelled');
    const { data: dbProducts } = await supabase.from('products').select('name,category,is_active');

    if (!orders) { setLoading(false); return; }

    const map = new Map<string, ProductPerf>();
    orders.forEach((o: any) => {
      let items = o.items;
      if (typeof items === 'string') try { items = JSON.parse(items); } catch { return; }
      if (!Array.isArray(items)) return;

      items.forEach((item: any) => {
        // Order items are saved with `product_name`/`quantity`/`pack_price` keys, not `name`/`qty`/`price`.
        const name = typeof item === 'string' ? item : (item.name || item.product_name || item.product || '');
        if (!name) return;
        if (!map.has(name)) {
          const dbP = dbProducts?.find((p: any) => p.name.toLowerCase() === name.toLowerCase());
          map.set(name, { name, category: dbP?.category || 'Unknown', totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, lastOrdered: '', returnRate: 0 });
        }
        const p = map.get(name)!;
        p.totalOrders++;
        const qty = typeof item === 'object' ? (item.qty ?? item.quantity ?? 1) : 1;
        const unitPrice = typeof item === 'object' ? (item.price ?? item.pack_price ?? 0) : 0;
        const price = unitPrice * qty;
        p.totalRevenue += price;
        if (!p.lastOrdered || o.created_at > p.lastOrdered) p.lastOrdered = o.created_at;
      });
    });

    const arr = Array.from(map.values());
    arr.forEach(p => { p.avgOrderValue = p.totalOrders > 0 ? Math.round(p.totalRevenue / p.totalOrders) : 0; });
    setProducts(arr);
    setLoading(false);
  }

  const sorted = [...products].sort((a, b) => sortBy === 'totalRevenue' ? b.totalRevenue - a.totalRevenue : b.totalOrders - a.totalOrders);
  const topProduct = sorted[0];
  const totalRev = products.reduce((s, p) => s + p.totalRevenue, 0);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Product Performance</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Revenue and order analytics per product</p>

      {/* Top performer */}
      {topProduct && (
        <div style={{ background: 'linear-gradient(135deg, #1a1008, #3d2b1f)', color: '#fff', borderRadius: 8, padding: 28, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#c8973a', marginBottom: 8 }}>🏆 Top Performer</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{topProduct.name}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>{topProduct.totalOrders} orders · ₹{topProduct.totalRevenue.toLocaleString('en-IN')} revenue</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#c8973a', fontFamily: 'Georgia, serif' }}>
              {totalRev > 0 ? Math.round(topProduct.totalRevenue / totalRev * 100) : 0}%
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>of total revenue</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}>
          <option value="totalRevenue">Sort by Revenue</option>
          <option value="totalOrders">Sort by Orders</option>
        </select>
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Orders</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Avg Price</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>% of Revenue</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Last Ordered</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 12, fontWeight: 700, color: i < 3 ? '#c8973a' : '#9ca3af' }}>{i + 1}</td>
                <td style={{ padding: 12, fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: 12 }}>
                  <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{p.category}</span>
                </td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>{p.totalOrders}</td>
                <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{p.totalRevenue.toLocaleString('en-IN')}</td>
                <td style={{ padding: 12, textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>₹{p.avgOrderValue.toLocaleString('en-IN')}</td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalRev > 0 ? Math.min(p.totalRevenue / totalRev * 100, 100) : 0}%`, background: '#c8973a', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6b7280', width: 32 }}>{totalRev > 0 ? Math.round(p.totalRevenue / totalRev * 100) : 0}%</span>
                  </div>
                </td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>
                  {p.lastOrdered ? new Date(p.lastOrdered).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
