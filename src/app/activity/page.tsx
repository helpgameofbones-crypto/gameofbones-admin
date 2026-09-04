'use client';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/app/lib/authedFetch'

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
    try {
      const response = await authedFetch('/api/admin/activity')
      const data = await response.json()
      setActivities(response.ok && Array.isArray(data.activities) ? data.activities : [])
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
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
