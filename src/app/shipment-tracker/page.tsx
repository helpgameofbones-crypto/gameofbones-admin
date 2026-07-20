'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { authedFetch } from '@/app/lib/authedFetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

// NOTE: a hardcoded Delhivery API token used to live here and was called
// directly from the browser — a live third-party credential visible to
// anyone opening devtools. Tracking now goes through the existing
// server-side /api/delhivery route (action: 'track'), same fix already
// applied to delhivery-sync/page.tsx.

// orders.customer_phone is stored XOR+base64 "encrypted" by the website's
// encryptData() — displaying/searching it raw showed ciphertext instead of
// a real phone number and made phone search silently never match anything.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan';
function decryptData(encrypted: string): string {
  if (!encrypted) return '';
  try {
    const binary = atob(encrypted);
    let result = '';
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return '';
  if (/^\+?\d{10,13}$/.test(raw)) return raw;
  const dec = decryptData(raw);
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw;
}

const STATUS_COLORS: Record<string, string> = {
  placed: '#f59e0b', confirmed: '#3b82f6', dispatched: '#8b5cf6',
  shipped: '#8b5cf6', out_for_delivery: '#06b6d4', delivered: '#16a34a',
  cancelled: '#ef4444', returned: '#dc2626'
};

export default function ShipmentTrackerPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [trackingDetail, setTrackingDetail] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => { fetchShipments(); }, []);

  async function fetchShipments() {
    setLoading(true);
    const { data, error } = await supabase.from('orders')
      .select('id,ref,status,delhivery_awb,customer_name,customer_phone,created_at,estimated_delivery,delivered_at')
      .not('delhivery_awb', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { console.error(error); setLoading(false); return; }
    setOrders((data || []).map(o => ({ ...o, customer_phone: decryptPhone(o.customer_phone) })));
    setLoading(false);
  }

  async function trackAwb(awb: string) {
    setTrackingLoading(true);
    setTrackingDetail(null);
    try {
      const res = await authedFetch('/api/delhivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'track', orderData: { awb } })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setTrackingDetail({ error: data.error || 'Failed to fetch tracking data' });
        return;
      }
      const shipment = data?.tracking?.ShipmentData?.[0]?.Shipment;
      setTrackingDetail(shipment || { error: 'No tracking data found for this AWB' });
    } catch (e: any) {
      setTrackingDetail({ error: e.message });
    }
    setTrackingLoading(false);
  }

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.ref || '').toLowerCase().includes(s) || (o.delhivery_awb || '').includes(s) ||
      (o.customer_name || '').toLowerCase().includes(s) || (o.customer_phone || '').includes(s);
  });

  const inTransit = orders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Shipment Tracker</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Track all shipments in one place</p>
        </div>
        <button onClick={fetchShipments} style={{ padding: '8px 16px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{orders.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Shipments</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{inTransit}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>In Transit</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{delivered}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</div>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref, AWB, name, or phone..."
        style={{ width: '100%', maxWidth: 400, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, marginBottom: 16 }} />

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? <p>Loading shipments...</p> : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚚</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No shipments found</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Order</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>AWB</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>{o.ref}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div>{o.customer_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{o.customer_phone}</div>
                    </td>
                    <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{o.delhivery_awb}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ background: (STATUS_COLORS[o.status] || '#6b7280') + '18', color: STATUS_COLORS[o.status] || '#6b7280', fontSize: 10, fontWeight: 700, padding: '3px 10px', textTransform: 'uppercase', borderRadius: 20 }}>{o.status}</span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button onClick={() => trackAwb(o.delhivery_awb)} style={{ padding: '4px 12px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Track</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {(trackingLoading || trackingDetail) && (
          <div style={{ width: 340, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, position: 'sticky', top: 24, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Tracking Detail</h3>
              <button onClick={() => setTrackingDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            {trackingLoading ? <p style={{ fontSize: 13, color: '#6b7280' }}>Loading...</p> : trackingDetail?.error ? (
              <p style={{ fontSize: 13, color: '#dc2626' }}>{trackingDetail.error}</p>
            ) : trackingDetail && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Current Status</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{trackingDetail.Status?.Status || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{trackingDetail.Status?.StatusLocation || ''}</div>
                </div>
                {trackingDetail.ExpectedDeliveryDate && (
                  <div style={{ marginBottom: 12, background: '#f0fdf4', padding: 10, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#16a34a' }}>Expected Delivery</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{trackingDetail.ExpectedDeliveryDate}</div>
                  </div>
                )}
                {trackingDetail.Scans && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>Scan History</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {trackingDetail.Scans.map((scan: any, i: number) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{scan.ScanDetail?.Instructions || scan.ScanDetail?.Scan || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{scan.ScanDetail?.ScannedLocation || ''} · {new Date(scan.ScanDetail?.ScanDateTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
