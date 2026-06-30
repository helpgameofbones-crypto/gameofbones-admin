'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBirthdays(); }, []);
  async function fetchBirthdays() { setLoading(true); const { data } = await supabase.from('customer_birthdays').select('*').order('created_at', { ascending: false }); setBirthdays(data || []); setLoading(false); }

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const upcomingBdays = birthdays.filter(b => b.birthday_month === thisMonth || b.birthday_month === (thisMonth % 12) + 1);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>🎂 Birthday Data</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{birthdays.length} birthdays captured</p>

      {upcomingBdays.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>🎉 Upcoming Birthdays ({upcomingBdays.length})</div>
          {upcomingBdays.map((b, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>
              <strong>{b.customer_name || b.dog_name}</strong> — {b.birthday_day}/{b.birthday_month} · {b.customer_phone}
            </div>
          ))}
        </div>
      )}

      {loading ? <p>Loading...</p> : birthdays.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No birthdays captured yet</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Birthday data from the spin wheel / popup will appear here.</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Phone</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Birthday</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Dog Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Captured</th>
            </tr>
          </thead>
          <tbody>
            {birthdays.map((b, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{b.customer_name || '—'}</td>
                <td style={{ padding: 12 }}>{b.customer_phone || '—'}</td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>{b.customer_email || '—'}</td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 700, color: '#c8973a' }}>
                  {b.birthday_day && b.birthday_month ? `${b.birthday_day}/${b.birthday_month}${b.birthday_year ? '/' + b.birthday_year : ''}` : '—'}
                </td>
                <td style={{ padding: 12 }}>{b.dog_name || '—'}</td>
                <td style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>
                  {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
