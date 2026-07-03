'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

interface ActivityItem {
  id: string;
  source: string;
  action: string;
  detail: string;
  timestamp: string;
}

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchActivity(); }, []);

  async function fetchActivity() {
    setLoading(true);
    const items: ActivityItem[] = [];

    // Order status changes (from audit_log)
    const { data: auditData } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
    (auditData || []).forEach((a: any) => {
      items.push({
        id: 'audit-' + a.id,
        source: 'Orders',
        action: `Status changed: ${a.old_data?.status || '?'} → ${a.new_data?.status || '?'}`,
        detail: `Order #${a.record_id}`,
        timestamp: a.created_at,
      });
    });

    // Recent orders placed
    const { data: orderData } = await supabase.from('orders').select('ref, customer_name, grand_total, total_amount, created_at').order('created_at', { ascending: false }).limit(30);
    (orderData || []).forEach((o: any) => {
      items.push({
        id: 'order-' + o.ref,
        source: 'Orders',
        action: 'New order placed',
        detail: `#${o.ref} — ${o.customer_name || 'Customer'} — ₹${o.grand_total || o.total_amount || 0}`,
        timestamp: o.created_at,
      });
    });

    // Recent blog changes
    const { data: blogData } = await supabase.from('blogs').select('title, created_at').order('created_at', { ascending: false }).limit(15);
    (blogData || []).forEach((b: any) => {
      items.push({
        id: 'blog-' + b.title,
        source: 'Content',
        action: 'Blog article created/updated',
        detail: b.title,
        timestamp: b.created_at,
      });
    });

    // Recent reorder alerts generated
    const { data: alertData } = await supabase.from('reorder_alerts').select('customer_name, alert_type, created_at').order('created_at', { ascending: false }).limit(15);
    (alertData || []).forEach((a: any, i: number) => {
      items.push({
        id: 'alert-' + i + '-' + a.created_at,
        source: 'Marketing',
        action: `${a.alert_type === 'winback' ? 'Win-back' : 'Reorder'} alert generated`,
        detail: a.customer_name || 'Customer',
        timestamp: a.created_at,
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(items.slice(0, 100));
    setLoading(false);
  }

  const filtered = filter === 'all' ? activities : activities.filter(a => a.source === filter);
  const sources = ['all', ...Array.from(new Set(activities.map(a => a.source)))];

  const sourceColors: Record<string, string> = {
    Orders: '#f59e0b', Content: '#06b6d4', Marketing: '#f97316', Products: '#16a34a',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Activity Log</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Recent activity across orders, content, and marketing</p>
        </div>
        <button onClick={fetchActivity} style={{ padding: '8px 16px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {sources.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              background: filter === s ? '#1a1008' : '#f3f4f6', color: filter === s ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <p>Loading activity...</p> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No activity yet</div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
          {filtered.map(a => {
            const color = sourceColors[a.source] || '#6b7280';
            return (
              <div key={a.id} style={{ position: 'relative', marginBottom: 16, paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 0 0 1px ' + color }} />
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ background: color + '18', color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{a.source}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {new Date(a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.action}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
