'use client';

import { useState, useEffect } from 'react';
import { authedFetch } from '@/app/lib/authedFetch';

interface EmailCapture {
  id: number;
  email: string;
  source: string;
  device_id: string | null;
  created_at: string;
  status: string;
  prize: string | null;
  coupon_code: string | null;
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
    const headers = ['Email', 'Source', 'Prize Won', 'Coupon Code', 'Date', 'Device ID'];
    const rows = emails.map(e => [
      e.email,
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
      <h1 style={styles.title}>📧 Email Captures Dashboard</h1>

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
            <option value="spin_wheel">Spin Wheel</option>
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
                    <a href={`mailto:${email.email}`} style={styles.link}>
                      {email.email}
                    </a>
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
