'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

// The table stores a single DATE column called "birthday" (e.g. 2000-06-15 if
// the owner didn't give a real year). We only ever care about day+month for
// reminders, so we extract those from the date string ourselves.
//
// FIX: both functions below were missing parameter type annotations, which
// is the same "implicitly has an 'any' type" error that was breaking the
// customers/orders/invoices pages — this file is next in line since the
// build type-checks every file in the project, not just the ones touched.
function getDayMonth(birthday: string): { day: number | null; month: number | null; year: number | null } {
  if (!birthday) return { day: null, month: null, year: null };
  const parts = birthday.split('-'); // YYYY-MM-DD
  if (parts.length !== 3) return { day: null, month: null, year: null };
  const year = parseInt(parts[0]);
  return { day: parseInt(parts[2]), month: parseInt(parts[1]), year: year === 2000 ? null : year };
}

function birthdayEmailBody(dogName: string, ownerName: string): string {
  return `Hi ${ownerName || 'there'},\n\nHappy Birthday to ${dogName}! 🎂🐾\n\nAs a special treat from Game of Bones, we'd love to send a birthday surprise. Check out our latest treats at gameofbones.in — free shipping on all orders!\n\nWishing ${dogName} many more years of happy tail wags.\n\n— Team Game of Bones`;
}

export default function DogBirthdayClubPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase.from('dog_birthdays').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); setLoading(false); return; }
    setEntries(data || []);
    setLoading(false);
  }

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const nextMonth = (thisMonth % 12) + 1;

  const enriched = entries.map((b: any) => ({ ...b, ...getDayMonth(b.birthday) }));
  const upcoming = enriched.filter((b: any) => b.month === thisMonth || b.month === nextMonth);
  const today = enriched.filter((b: any) => b.day === now.getDate() && b.month === thisMonth);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>🎂 Dog Birthday Club</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{entries.length} pets registered · Data from website birthday popup</p>

      {today.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#92400e', marginBottom: 12 }}>🎉 Today's Birthdays!</div>
          {today.map((b: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < today.length - 1 ? '1px solid #fde68a' : 'none' }}>
              <div>
                <strong>{b.dog_name}</strong> — Owner: {b.customer_name || '—'}
                <div style={{ fontSize: 12, color: '#92400e' }}>📱 {b.customer_phone} · 📧 {b.customer_email || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {b.customer_phone && (
                  <a href={`https://wa.me/91${b.customer_phone}?text=${encodeURIComponent(`Happy Birthday to ${b.dog_name}! 🎂🐾 As a special treat from Game of Bones, we'd love to send a birthday surprise. Check out gameofbones.in for our latest treats!`)}`}
                    target="_blank" rel="noopener" style={{ padding: '6px 14px', background: '#25d366', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    💬 WhatsApp
                  </a>
                )}
                {b.customer_email && (
                  <a href={`mailto:${b.customer_email}?subject=${encodeURIComponent('Happy Birthday ' + b.dog_name + '! 🎂')}&body=${encodeURIComponent(birthdayEmailBody(b.dog_name, b.customer_name))}`}
                    style={{ padding: '6px 14px', background: '#1a1008', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    ✉️ Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 8 }}>📅 Upcoming ({upcoming.length} this month & next)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {upcoming.map((b: any, i: number) => (
              <span key={i} style={{ background: '#fff', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>
                {b.dog_name} — {b.day}/{b.month}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{entries.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Pets</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{upcoming.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Upcoming</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{entries.filter((b: any) => b.customer_email).length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>With Email</div>
        </div>
      </div>

      {loading ? <p>Loading...</p> : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No birthdays captured yet</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>The birthday popup on the website saves data here. It appears after 60 seconds to visitors.</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Pet Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Owner</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Phone</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Birthday</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Signed Up</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((b: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 12, fontWeight: 700 }}>🐾 {b.dog_name || '—'}</td>
                <td style={{ padding: 12 }}>{b.customer_name || '—'}</td>
                <td style={{ padding: 12 }}>{b.customer_phone || '—'}</td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>{b.customer_email || '—'}</td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 700, color: '#c8973a' }}>
                  {b.day && b.month ? `${b.day}/${b.month}${b.year ? '/' + b.year : ''}` : '—'}
                </td>
                <td style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>
                  {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {b.customer_phone ? (
                      <a href={`https://wa.me/91${b.customer_phone}?text=${encodeURIComponent(`Hi ${b.customer_name || ''}! 🐾 Just a reminder that ${b.dog_name}'s birthday is coming up on ${b.day}/${b.month}. We have a special birthday surprise at gameofbones.in!`)}`}
                        target="_blank" rel="noopener" style={{ fontSize: 11, color: '#25d366', fontWeight: 700, textDecoration: 'none' }}>
                        💬 WhatsApp
                      </a>
                    ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>No phone</span>}
                    {b.customer_email ? (
                      <a href={`mailto:${b.customer_email}?subject=${encodeURIComponent(b.dog_name + "'s Birthday is Coming Up! 🎂")}&body=${encodeURIComponent(`Hi ${b.customer_name || 'there'},\n\nJust a reminder that ${b.dog_name}'s birthday is coming up on ${b.day}/${b.month}!\n\nWe have a special birthday surprise waiting at gameofbones.in — free shipping on all orders.\n\n— Team Game of Bones`)}`}
                        style={{ fontSize: 11, color: '#1a1008', fontWeight: 700, textDecoration: 'none' }}>
                        ✉️ Email
                      </a>
                    ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>No email</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
