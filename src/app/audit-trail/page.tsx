'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

interface AuditEntry {
  id: number; table_name: string; record_id: string; action: string;
  old_data: any; new_data: any; changed_by: string; created_at: string;
}

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchAudit(); }, []);

  async function fetchAudit() {
    setLoading(true);
    const { data } = await supabase.from('audit_log')
      .select('*').order('created_at', { ascending: false }).limit(200);
    setEntries(data || []);
    setLoading(false);
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter);

  const actionColors: Record<string, string> = {
    STATUS_CHANGE: '#8b5cf6', INSERT: '#16a34a', UPDATE: '#3b82f6', DELETE: '#ef4444'
  };
  const actionIcons: Record<string, string> = {
    STATUS_CHANGE: '🔄', INSERT: '➕', UPDATE: '✏️', DELETE: '🗑️'
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Audit Trail</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Track all status changes and system events</p>
        </div>
        <button onClick={fetchAudit} style={{ padding: '8px 16px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>↻ Refresh</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'STATUS_CHANGE', 'INSERT', 'UPDATE', 'DELETE'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              background: filter === f ? '#1a1008' : '#f3f4f6', color: filter === f ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4, cursor: 'pointer', letterSpacing: '.05em' }}>
            {f === 'all' ? `All (${entries.length})` : `${f.replace('_', ' ')} (${entries.filter(e => e.action === f).length})`}
          </button>
        ))}
      </div>

      {loading ? <p>Loading audit trail...</p> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No audit entries yet</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Status changes on orders will appear here automatically.</div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
          {filtered.map(entry => {
            const color = actionColors[entry.action] || '#6b7280';
            const icon = actionIcons[entry.action] || '📝';
            const oldVal = entry.old_data?.status || JSON.stringify(entry.old_data);
            const newVal = entry.new_data?.status || JSON.stringify(entry.new_data);
            const time = new Date(entry.created_at);

            return (
              <div key={entry.id} style={{ position: 'relative', marginBottom: 20, paddingLeft: 20 }}>
                {/* Timeline dot */}
                <div style={{ position: 'absolute', left: -26, top: 4, width: 24, height: 24, borderRadius: '50%', background: color + '18', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, zIndex: 1 }}>
                  {icon}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ background: color + '18', color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{entry.action.replace('_', ' ')}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8 }}>{entry.table_name} #{entry.record_id}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {entry.action === 'STATUS_CHANGE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{oldVal}</span>
                      <span style={{ color: '#9ca3af' }}>→</span>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{newVal}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>by {entry.changed_by}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
