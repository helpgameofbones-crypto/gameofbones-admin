'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabaseBrowserClient'
import { authedFetch } from '@/app/lib/authedFetch';

interface OrderETA {
  id: number; ref: string; customer_name: string; customer_phone: string;
  delhivery_awb: string; status: string; created_at: string;
  estimated_delivery: string; delhiveryETA: string | null; daysRemaining: number | null;
}

export default function DeliveryEstimatorPage() {
  const [orders, setOrders] = useState<OrderETA[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('orders')
      .select('id,ref,customer_name,customer_phone,delhivery_awb,status,created_at,estimated_delivery')
      .not('delhivery_awb', 'is', null)
      .not('status', 'in', '(delivered,cancelled,returned)')
      .order('created_at', { ascending: false });
    setOrders((data || []).map((o: any) => ({ ...o, delhiveryETA: o.estimated_delivery || null, daysRemaining: null })));
    setLoading(false);
  }

  // Tracking used to hit track.delhivery.com directly from the browser with
  // a hardcoded API token, which silently failed on every request (stale
  // token, and a live credential exposed in client-side code). This now
  // goes through the server-side /api/delhivery route (action: 'track'),
  // same fix already applied to shipment-tracker/page.tsx and
  // delhivery-sync/page.tsx.
  async function fetchETAs() {
    setFetching(true);
    setFetchMsg('');
    const updated = [...orders];
    let failed = 0;
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
        if (!res.ok || data.error || !shipment) { failed++; continue; }
        if (shipment.ExpectedDeliveryDate) {
          order.delhiveryETA = shipment.ExpectedDeliveryDate;
          const eta = new Date(shipment.ExpectedDeliveryDate);
          const now = new Date();
          order.daysRemaining = Math.ceil((eta.getTime() - now.getTime()) / 86400000);
          await supabase.from('orders').update({ estimated_delivery: shipment.ExpectedDeliveryDate }).eq('id', order.id);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    setOrders(updated);
    setFetching(false);
    if (failed > 0) {
      setFetchMsg(`Could not fetch an ETA for ${failed} of ${updated.length} shipment(s) -- Delhivery may not have tracking data yet for very recent AWBs.`);
    }
  }

  const now = new Date();
  const inTransit = orders.filter(o => o.daysRemaining !== null && o.daysRemaining > 0).length;
  const overdue = orders.filter(o => o.daysRemaining !== null && o.daysRemaining < 0).length;
  const dueToday = orders.filter(o => o.daysRemaining === 0).length;
  const onTrack = orders.filter(o => o.daysRemaining !== null && o.daysRemaining >= 0).length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Delivery Estimator</h1>
        <button
          onClick={fetchETAs}
          disabled={fetching || loading || orders.length === 0}
          style={{ padding: '10px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fetching ? 'default' : 'pointer', opacity: fetching ? 0.6 : 1 }}
        >
          {fetching ? 'Fetching...' : 'Fetch All ETAs'}
        </button>
      </div>

      {fetchMsg && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 13 }}>
          {fetchMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>IN TRANSIT</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{inTransit}</div>
        </div>
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>OVERDUE</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{overdue}</div>
        </div>
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>DUE TODAY</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{dueToday}</div>
        </div>
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>ON TRACK</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{onTrack}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No active shipments with an AWB found.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>REF</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>CUSTOMER</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>AWB</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>STATUS</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>ORDERED</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>EST. DELIVERY</th>
              <th style={{ padding: 12, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>DAYS</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const eta = o.delhiveryETA;
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
