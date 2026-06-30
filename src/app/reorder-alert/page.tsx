'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

const FN_URL = 'https://syuostlqzzinigqwjzap.supabase.co/functions/v1';

export default function ReorderAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchAlerts(); }, []);

  async function fetchAlerts() {
    setLoading(true);
    const { data } = await supabase.from('reorder_alerts').select('*').order('days_since_last_order', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }

  async function runScan() {
    setScanning(true); setScanResult(null);
    try {
      const res = await fetch(`${FN_URL}/auto-reorder-alerts`, { method: 'POST' });
      const data = await res.json();
      setScanResult(data);
      fetchAlerts();
    } catch (e: any) { setScanResult({ error: e.message }); }
    setScanning(false);
  }

  async function dismiss(id: number) {
    await supabase.from('reorder_alerts').update({ alert_status: 'dismissed' }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, alert_status: 'dismissed' } : a));
  }

  async function markSent(id: number) {
    await supabase.from('reorder_alerts').update({ alert_status: 'sent' }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, alert_status: 'sent' } : a));
  }

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.alert_type === filter || a.alert_status === filter);
  const reorderCount = alerts.filter(a => a.alert_type === 'reorder' && a.alert_status === 'pending').length;
  const winbackCount = alerts.filter(a => a.alert_type === 'winback' && a.alert_status === 'pending').length;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Auto-Reorder Alerts</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Customers who may be running low on treats</p>
        </div>
        <button onClick={runScan} disabled={scanning}
          style={{ padding: '12px 24px', background: scanning ? '#9ca3af' : '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: scanning ? 'wait' : 'pointer', fontSize: 14, fontWeight: 700 }}>
          {scanning ? '⏳ Scanning...' : '🔍 Scan Now'}
        </button>
      </div>

      {scanResult && (
        <div style={{ background: scanResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${scanResult.error ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          {scanResult.error ? (
            <div style={{ color: '#dc2626' }}>❌ {scanResult.error}</div>
          ) : (
            <div style={{ color: '#16a34a' }}>
              ✅ Scanned {scanResult.totalCustomers} customers ({scanResult.customersWithRepeatOrders} repeat buyers) — 
              <strong>{scanResult.alertsGenerated} alerts</strong> generated ({scanResult.reorderAlerts} reorder, {scanResult.winbackAlerts} winback)
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{alerts.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Alerts</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{reorderCount}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Running Low</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{winbackCount}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Win-Back Needed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'reorder', 'winback', 'sent', 'dismissed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              background: filter === f ? '#1a1008' : '#f3f4f6', color: filter === f ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No alerts yet</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Click "Scan Now" to analyze customer purchase patterns and generate alerts.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(a => {
            const isOverdue = a.days_since_last_order > a.avg_order_interval_days;
            const urgency = a.alert_type === 'winback' ? '#ef4444' : isOverdue ? '#f59e0b' : '#16a34a';

            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, opacity: a.alert_status === 'dismissed' ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{a.customer_name || 'Unknown'}</span>
                      <span style={{ background: urgency + '18', color: urgency, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>
                        {a.alert_type === 'winback' ? '🔴 Win-back' : isOverdue ? '🟡 Overdue' : '🟢 Due soon'}
                      </span>
                      {a.alert_status !== 'pending' && (
                        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>({a.alert_status})</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>📱 {a.customer_phone} · {a.total_orders} orders · ₹{(a.total_spent || 0).toLocaleString('en-IN')} total</div>
                  </div>
                  {a.alert_status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={`https://wa.me/91${a.customer_phone}?text=${encodeURIComponent(`Hi ${a.customer_name || ''}! 🐾 It's been a while since your last Game of Bones order. Your ${(a.top_products || [])[0] || 'treats'} might be running low — reorder now at gameofbones.in and get free shipping! 🦴`)}`}
                        target="_blank" rel="noopener"
                        style={{ padding: '6px 14px', background: '#25d366', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        💬 WhatsApp
                      </a>
                      <button onClick={() => markSent(a.id)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✓ Sent</button>
                      <button onClick={() => dismiss(a.id)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#9ca3af' }}>Dismiss</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={{ background: '#f9fafb', padding: 10, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Last Order</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.days_since_last_order}d ago</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: 10, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Avg Interval</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Every {a.avg_order_interval_days}d</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: 10, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Est. Runout</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: urgency }}>{a.estimated_runout_date}</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: 10, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Top Products</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{(a.top_products || []).join(', ') || '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
