'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchReferrals(); }, []);

  async function fetchReferrals() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setReferrals(data || []);
    setLoading(false);
  }

  const totalPointsAwarded = referrals.reduce((s, r) => s + (r.points_awarded || 0), 0);
  const uniqueReferrers = new Set(referrals.map(r => r.referrer_phone)).size;

  // Group by referrer to show leaderboard
  const leaderboard = Array.from(
    referrals.reduce((map, r) => {
      const phone = r.referrer_phone;
      if (!map.has(phone)) map.set(phone, { phone, count: 0, points: 0 });
      const entry = map.get(phone);
      entry.count++;
      entry.points += r.points_awarded || 0;
      return map;
    }, new Map()).values()
  ).sort((a: any, b: any) => b.count - a.count);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Referrals</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Track referral signups and rewards</p>
        </div>
        <button onClick={fetchReferrals} style={{ padding: '8px 16px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          ❌ Failed to load: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{referrals.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Referrals</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#c8973a' }}>{uniqueReferrers}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Active Referrers</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{totalPointsAwarded}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Points Awarded</div>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          {leaderboard.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🏆 Top Referrers</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaderboard.slice(0, 5).map((r: any, i: number) => (
                  <div key={r.phone} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
                    <span style={{ fontWeight: 700, color: i < 3 ? '#c8973a' : '#9ca3af', width: 24 }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{r.phone}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{r.count} referral{r.count > 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{r.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>All Referrals</h3>
          {referrals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No referrals yet</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Referrals will appear here once customers start sharing their referral links.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referrer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referred</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Points</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{r.referrer_phone}</td>
                    <td style={{ padding: 12 }}>{r.referred_phone}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>+{r.points_awarded || 0}</td>
                    <td style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
