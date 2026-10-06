'use client';

import { useState, useEffect } from 'react';
import { authedFetch } from '@/app/lib/authedFetch';

interface EmailCapture {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  source: string;
  device_id: string | null;
  created_at: string;
  status: string;
  prize: string | null;
  coupon_code: string | null;
}

type GameStats = {
  players: number; games: number; finished: number; top_score: number;
  won_tier1: number; won_tier2: number; won_tier3: number; winners: number;
  forms: number; forms_by_prize: Record<string, number>;
  redeemed: number; redeemed_by_prize: Record<string, number>;
};

const PRIZES = [
  { key: 'won_tier1' as const, label: '2 free Goat Trachea', points: '800', icon: '🦴' },
  { key: 'won_tier2' as const, label: '1 free pack of Chicken Feet (70 g)', points: '2,500', icon: '🐾' },
  { key: 'won_tier3' as const, label: '1 free pack of Mackerel Fillet (60 g)', points: '5,000', icon: '🐟' },
];

function GameStatsPanel() {
  const [days, setDays] = useState(0);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(`/api/admin/game-stats${days ? `?days=${days}` : ''}`);
        if (!res.ok) throw new Error('Could not load game stats');
        const data = await res.json();
        if (!cancelled) { setStats(data.stats); setErr(''); }
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load game stats'); }
    })();
    return () => { cancelled = true; };
  }, [days]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const card = (label: string, value: string | number, sub?: string) => (
    <div style={{ background: '#fff', border: '1px solid #e7dcc4', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a7350' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#102c22', marginTop: 4, fontFamily: 'Georgia, serif' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7a6a55', marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return (
    <section style={{ background: '#fbf7ee', border: '1px solid #e7dcc4', borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9a6514' }}>Bone Run game</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#102c22' }}>Players → winners → claims → rewards used</div>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d9ccae' }}>
          <option value={0}>All time</option><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select>
      </div>
      {err && <div style={{ color: '#b23a2e', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {stats && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          {card('People who played', stats.players, `${stats.games} games played · top score ${Number(stats.top_score).toLocaleString('en-IN')}`)}
          {card('Won a prize', stats.winners, `${pct(stats.winners, stats.players)} of players reached 800+`)}
          {card('Filled the claim form', stats.forms, `${pct(stats.forms, stats.winners)} of winners`)}
          {card('Reward used on an order', stats.redeemed, `${pct(stats.redeemed, stats.forms)} of claims`)}
        </div>
        <table style={{ width: '100%', marginTop: 14, borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', fontSize: 13 }}>
          <thead><tr style={{ background: '#102c22', color: '#f6efe2', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px' }}>Prize</th><th style={{ padding: '10px 12px' }}>Points</th><th style={{ padding: '10px 12px' }}>Won (best run)</th><th style={{ padding: '10px 12px' }}>Form filled</th><th style={{ padding: '10px 12px' }}>Used on order</th>
          </tr></thead>
          <tbody>{PRIZES.map(p => (
            <tr key={p.key} style={{ borderTop: '1px solid #eee4d0' }}>
              <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.icon} {p.label}</td>
              <td style={{ padding: '10px 12px' }}>{p.points}</td>
              <td style={{ padding: '10px 12px' }}>{stats[p.key]}</td>
              <td style={{ padding: '10px 12px' }}>{stats.forms_by_prize?.[p.label] || 0}</td>
              <td style={{ padding: '10px 12px' }}>{stats.redeemed_by_prize?.[p.label] || 0}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ fontSize: 11.5, color: '#7a6a55', marginTop: 8 }}>Players are counted per device. &ldquo;Won&rdquo; counts each player once at their highest prize. Play tracking started on 7 Oct 2026.</div>
      </>)}
    </section>
  );
}

export default function EmailCaptures() {
  const [emails, setEmails] = useState<EmailCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await authedFetch('/api/email-captures');

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setEmails(data.emails || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmail = async (id: number) => {
    if (!confirm('Are you sure you want to delete this email?')) return;

    try {
      const res = await authedFetch('/api/email-captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!res.ok) throw new Error('Failed to delete');

      fetchEmails();
      alert('Email deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert('Error deleting email: ' + errorMessage
);
    }
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Prize Won', 'Coupon Code', 'Date', 'Device ID'];
    const rows = emails.map(e => [
      e.name || '',
      e.phone || '',
      e.email || 'Not collected (legacy)',
      e.source || 'unknown',
      e.prize || '',
      e.coupon_code || '',
      new Date(e.created_at).toLocaleDateString(),
      e.device_id || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `email_captures_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEmails = filter === 'all'
    ? emails
    : emails.filter(e => e.source === filter);

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading emails...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎮 Game Leads</h1>

      <GameStatsPanel />

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={styles.toolbar}>
        <div>
          <strong>Total Emails: {emails.length}</strong>
          <span style={styles.subtitle}> | {filteredEmails.length} shown</span>
        </div>

        <div style={styles.toolbarActions}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Sources</option>
            <option value="spin_to_win">Spin to Win</option>
            <option value="bone_run">Bone Run game (form filled)</option>
            <option value="spin_wheel">Legacy Spin Wheel</option>
            <option value="newsletter">Newsletter</option>
            <option value="dog_birthday">Dog Birthday Club</option>
            <option value="exit-intent">Exit-Intent Popup</option>
          </select>

          <button
            onClick={downloadCSV}
            style={{
              ...styles.button,
              opacity: filteredEmails.length === 0 ? 0.5 : 1,
              cursor: filteredEmails.length === 0 ? 'not-allowed' : 'pointer'
            }}
            disabled={filteredEmails.length === 0}
          >
            📥 Download CSV
          </button>

          <button
            onClick={fetchEmails}
            style={styles.buttonSecondary}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {filteredEmails.length === 0 ? (
        <p style={styles.noData}>No emails captured yet.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headerRow}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Source</th>
                <th style={styles.th}>Prize Won</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Device</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmails.map((email, idx) => (
                <tr key={email.id} style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  <td style={styles.td}>
                    {email.name || '—'}
                  </td>
                  <td style={styles.td}>
                    {email.phone || '—'}
                  </td>
                  <td style={styles.td}>
                    {email.email ? (
                      <a href={`mailto:${email.email}`} style={styles.link}>
                        {email.email}
                      </a>
                    ) : (
                      <span style={styles.time}>Not collected (legacy)</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge}>
                      {email.source || 'unknown'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {email.prize ? (
                      <>
                        <span style={styles.prizeLabel}>{email.prize}</span>
                        {email.coupon_code && (
                          <><br /><code style={styles.code}>{email.coupon_code}</code></>
                        )}
                      </>
                    ) : (
                      <span style={styles.time}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {new Date(email.created_at).toLocaleDateString()}
                    <br />
                    <span style={styles.time}>
                      {new Date(email.created_at).toLocaleTimeString()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.code}>
                      {email.device_id ? email.device_id.slice(0, 8) : 'N/A'}
                    </code>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => deleteEmail(email.id)}
                      style={styles.deleteButton}
                      title="Delete this email"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: "'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    backgroundColor: '#faf6f0',
    minHeight: '100vh'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '30px',
    color: '#1a1008'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '16px 20px',
    backgroundColor: '#fff',
    border: '1px solid #ede5d8',
    borderRadius: '4px',
    gap: '20px',
    flexWrap: 'wrap'
  },
  toolbarActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  subtitle: {
    color: '#7a6a5a',
    fontSize: '14px'
  },
  select: {
    padding: '10px 12px',
    border: '1.5px solid #ede5d8',
    backgroundColor: '#faf6f0',
    fontFamily: "'Jost', sans-serif",
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '4px'
  },
  button: {
    padding: '10px 16px',
    backgroundColor: '#3d2b1f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'background 0.2s',
    fontFamily: "'Jost', sans-serif"
  },
  buttonSecondary: {
    padding: '10px 16px',
    backgroundColor: '#d4c4ae',
    color: '#1a1008',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'background 0.2s',
    fontFamily: "'Jost', sans-serif"
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #ede5d8',
    borderRadius: '4px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  headerRow: {
    backgroundColor: '#1a1008',
    color: '#fff'
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '700',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontSize: '11px'
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #ede5d8'
  },
  rowEven: {
    backgroundColor: '#faf6f0'
  },
  rowOdd: {
    backgroundColor: '#fff'
  },
  link: {
    color: '#2a7c6f',
    textDecoration: 'none',
    fontWeight: '600',
    cursor: 'pointer'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#e0b060',
    color: '#1a1008',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: '3px',
    textTransform: 'uppercase'
  },
  code: {
    fontSize: '11px',
    color: '#7a6a5a',
    backgroundColor: '#f5e8c8',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace'
  },
  prizeLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1008'
  },
  time: {
    fontSize: '11px',
    color: '#7a6a5a'
  },
  deleteButton: {
    padding: '6px 10px',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'background 0.2s',
    fontFamily: "'Jost', sans-serif"
  },
  error: {
    padding: '16px',
    marginBottom: '20px',
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    color: '#991b1b',
    borderRadius: '4px',
    fontSize: '14px'
  },
  loading: {
    textAlign: 'center',
    color: '#7a6a5a',
    fontSize: '16px',
    padding: '40px'
  },
  noData: {
    textAlign: 'center',
    color: '#7a6a5a',
    fontSize: '16px',
    padding: '40px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #ede5d8'
  }
};
