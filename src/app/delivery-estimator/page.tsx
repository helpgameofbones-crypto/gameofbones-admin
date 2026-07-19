'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { authedFetch } from '@/app/lib/authedFetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

// SECURITY: this used to call track.delhivery.com directly from the browser
// with a hardcoded API token embedded right in this file — visible to anyone
// who opened devtools on this page. Now routed through the already-existing,
// already-authenticated /api/delhivery server route (action: 'track'), which
// keeps the real Delhivery token server-side only (DELHIVERY_API_TOKEN env
// var). If that hardcoded token above is still live, rotate it in Delhivery's
// dashboard — it's been shipping to the browser bundle.

interface OrderETA {
  id: number; ref: string; customer_name: string; customer_phone: string;
  delhivery_awb: string; status: string; created_at: string;
  estimated_delivery: string; delhiveryETA: string | null; daysRemaining: number | null;
}

export default function DeliveryEstimatorPage() {
  const [orders, setOrders] = useState<OrderETA[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('orders')
      .select('id,ref,customer_name,customer_phone,delhivery_awb,status,created_at,estimated_delivery')
      .not('delhivery_awb', 'is', null)
      .not('status', 'in', '(delivered,cancelled,returned)')
      .order('created_at', { ascending: false });
    setOrders((data || []).map((o: any) => ({ ...o, delhiveryETA: null, daysRemaining: null })));
    setLoading(false);
  }

  async function fetchETAs() {
    setFetching(true);
    const updated = [...orders];
    for (const order of updated) {
      if (!order.delhivery_awb) continue;
      try {
        const res = await authedFetch('/api/delhivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'track', orderData: { awb: order.delhivery_awb } })
        });
        const data = await res.json();
        const shipment = data?.tracking?.ShipmentData?.[0]?.Shipment;
        if (shipment?.ExpectedDeliveryDate) {
          order.delhiveryETA = shipment.ExpectedDeliveryDate;
          const eta = new Date(shipment.ExpectedDeliveryDate);
          const now = new Date();
          order.daysRemaining = Math.ceil((eta.getTime() - now.getTime()) / 86400000);
          // Also update in Supabase
          await supabase.from('orders').update({ estimated_delivery: shipment.ExpectedDeliveryDate }).eq('id', order.id);
        }
      } catch (e) { /* skip */ }
    }
    setOrders(updated);
    setFetching(false);
  }

  const overdue = orders.filter(o => o.daysRemaining !== null && o.daysRemaining < 0);
  const dueToday = orders.filter(o => o.daysRemaining === 0);
  const upcoming = orders.filter(o => o.daysRemaining !== null && o.daysRemaining > 0);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Delivery Estimator</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Estimated delivery dates from Delhivery</p>
        </div>
        <button onClick={fetchETAs} disabled={fetching}
          style={{ padding: '10px 20px', background: fetching ? '#9ca3af' : '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: fetching ? 'wait' : 'pointer', fontWeight: 700 }}>
          {fetching ? '⏳ Fetching ETAs...' : '📅 Fetch All ETAs'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{orders.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>In Transit</div>
        </div>
        <div style={{ background: overdue.length > 0 ? '#fef2f2' : '#fff', border: `1px solid ${overdue.length > 0 ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{overdue.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Overdue</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{dueToday.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Due Today</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{upcoming.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>On Track</div>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Order</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>AWB</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Ordered</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Est. Delivery</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Days Left</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const eta = o.delhiveryETA || o.estimated_delivery;
              const isOverdue = o.daysRemaining !== null && o.daysRemaining < 0;
              return (
                <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6', background: isOverdue ? '#fef2f2' : '' }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{o.ref}</td>
                  <td style={{ padding: 12 }}>
                    <div>{o.customer_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{o.customer_phone}</div>
                  </td>
                  <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
                    <a href={`https://www.delhivery.com/track/package/${o.delhivery_awb}`} target="_blank" style={{ color: '#0284c7' }}>{o.delhivery_awb}</a>
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', background: '#f3f4f6' }}>{o.status}</span>
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: eta ? '#16a34a' : '#9ca3af', fontWeight: eta ? 600 : 400 }}>
                    {eta || 'Click "Fetch All ETAs"'}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {o.daysRemaining !== null ? (
                      <span style={{ fontWeight: 700, color: isOverdue ? '#ef4444' : o.daysRemaining === 0 ? '#f59e0b' : '#16a34a' }}>
                        {isOverdue ? `${Math.abs(o.daysRemaining)}d overdue` : o.daysRemaining === 0 ? 'Today' : `${o.daysRemaining}d`}
                      </span>
                    ) : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}