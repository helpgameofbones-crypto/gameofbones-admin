'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

const SUPABASE_FN_URL = 'https://syuostlqzzinigqwjzap.supabase.co/functions/v1';
const DELHIVERY_TOKEN = '590d454727ba1419777966ef591787d330b5cc30';

export default function DelhiverySyncPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackAwb, setTrackAwb] = useState('');

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('orders')
      .select('id,ref,status,delhivery_awb,customer_name,customer_phone,estimated_delivery,delivered_at,created_at')
      .not('delhivery_awb', 'is', null)
      .order('created_at', { ascending: false }).limit(100);
    setOrders(data || []);
    setLoading(false);
  }

  async function syncAllStatuses() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${SUPABASE_FN_URL}/sync-delhivery-status`, { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      fetchOrders();
    } catch (e: any) {
      setSyncResult({ error: e.message });
    }
    setSyncing(false);
  }

  async function trackSingle(awb: string) {
    setTrackResult(null);
    try {
      const res = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${awb}`, {
        headers: { 'Authorization': `Token ${DELHIVERY_TOKEN}` }
      });
      const data = await res.json();
      setTrackResult(data?.ShipmentData?.[0]?.Shipment || { error: 'No data found' });
    } catch (e: any) {
      setTrackResult({ error: e.message });
    }
  }

  const statusColors: Record<string, string> = {
    placed: '#f59e0b', confirmed: '#3b82f6', dispatched: '#8b5cf6',
    shipped: '#8b5cf6', out_for_delivery: '#06b6d4', delivered: '#16a34a',
    cancelled: '#ef4444', returned: '#dc2626'
  };

  const pendingSync = orders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Delhivery Sync</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Auto-sync order status from Delhivery tracking system</p>
        </div>
        <button onClick={syncAllStatuses} disabled={syncing}
          style={{ padding: '12px 24px', background: syncing ? '#9ca3af' : '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: syncing ? 'wait' : 'pointer', fontSize: 14, fontWeight: 700 }}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync All Statuses'}
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{ background: syncResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${syncResult.error ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          {syncResult.error ? (
            <div style={{ color: '#dc2626' }}>❌ {syncResult.error}</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>✅ Sync complete: {syncResult.synced} of {syncResult.total} orders updated</div>
              {syncResult.results?.filter((r: any) => r.newStatus).map((r: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', padding: '4px 0' }}>
                  #{r.ref}: {r.oldStatus} → <strong>{r.newStatus}</strong> {r.estimatedDate ? `(ETA: ${r.estimatedDate})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{orders.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Shipments</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{pendingSync.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Pending Sync</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{orders.filter(o => o.status === 'delivered').length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{orders.filter(o => ['dispatched', 'shipped'].includes(o.status)).length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>In Transit</div>
        </div>
      </div>

      {/* Manual AWB tracker */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Track Individual AWB</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={trackAwb} onChange={e => setTrackAwb(e.target.value)} placeholder="Enter AWB number"
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} />
          <button onClick={() => trackSingle(trackAwb)} style={{ padding: '10px 20px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Track</button>
        </div>
        {trackResult && (
          <div style={{ marginTop: 12, background: '#fff', padding: 16, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
            {trackResult.error ? <div style={{ color: '#dc2626' }}>{trackResult.error}</div> : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><strong>Status:</strong> {trackResult.Status?.Status || '—'}</div>
                  <div><strong>Location:</strong> {trackResult.Status?.StatusLocation || '—'}</div>
                  <div><strong>ETA:</strong> {trackResult.ExpectedDeliveryDate || '—'}</div>
                </div>
                {trackResult.Scans && (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Scan History</div>
                    {trackResult.Scans.map((scan: any, i: number) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af', width: 120, flexShrink: 0 }}>
                          {new Date(scan.ScanDetail?.ScanDateTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 12 }}>{scan.ScanDetail?.Instructions || scan.ScanDetail?.Scan || '—'}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{scan.ScanDetail?.ScannedLocation || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orders with AWB table */}
      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Order</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>AWB</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Est. Delivery</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{o.ref}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </td>
                <td style={{ padding: 12 }}>
                  <div style={{ fontWeight: 500 }}>{o.customer_name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{o.customer_phone}</div>
                </td>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
                  <a href={`https://www.delhivery.com/track/package/${o.delhivery_awb}`} target="_blank" rel="noopener" style={{ color: '#0284c7' }}>{o.delhivery_awb}</a>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span style={{ background: (statusColors[o.status] || '#6b7280') + '18', color: statusColors[o.status] || '#6b7280', fontSize: 10, fontWeight: 700, padding: '3px 10px', textTransform: 'uppercase', borderRadius: 20 }}>
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: 12, fontSize: 12, color: o.estimated_delivery ? '#16a34a' : '#9ca3af' }}>
                  {o.estimated_delivery || (o.delivered_at ? `Delivered ${new Date(o.delivered_at).toLocaleDateString('en-IN')}` : '—')}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button onClick={() => { setTrackAwb(o.delhivery_awb); trackSingle(o.delhivery_awb); }}
                    style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    Track
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
