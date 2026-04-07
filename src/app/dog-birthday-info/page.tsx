'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Birthday {
  id: string;
  owner_name: string;
  dog_name: string;
  birthday: string;
  phone: string;
  email: string;
  discount_percent: number;
  last_discount_sent: string | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DogBirthdayPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const fetchBirthdays = async () => {
    try {
      const { data, error } = await supabase
        .from('dog_birthdays')
        .select('*')
        .order('birthday', { ascending: true });

      if (error) throw error;
      setBirthdays((data || []) as Birthday[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = birthdays.filter(b =>
    !search || 
    b.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.dog_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search)
  );

  const upcoming = filtered.filter(b => new Date(b.birthday) >= new Date());
  const past = filtered.filter(b => new Date(b.birthday) < new Date());

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '24px', color: '#1a1008' }}>🎂 Dog Birthday Club</h1>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '10px 16px', border: '1px solid #ede5d8', flex: 1, maxWidth: '300px', fontSize: '14px' }}
        />
        <button onClick={fetchBirthdays} style={{ padding: '10px 24px', background: '#c8973a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Refresh</button>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#1a1008' }}>📅 Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: '#7a6a5a' }}>No upcoming birthdays</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {upcoming.map(b => (
              <div key={b.id} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>OWNER</p><p style={{ color: '#1a1008' }}>{b.owner_name}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>DOG</p><p style={{ color: '#1a1008' }}>{b.dog_name}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>BIRTHDAY</p><p style={{ color: '#1a1008' }}>{new Date(b.birthday).toLocaleDateString()}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>PHONE</p><p style={{ color: '#1a1008' }}>{b.phone}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>DISCOUNT</p><p style={{ color: '#c8973a', fontWeight: '600' }}>{b.discount_percent}%</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#1a1008' }}>✅ Past ({past.length})</h2>
        {past.length === 0 ? (
          <p style={{ color: '#7a6a5a' }}>No past birthdays</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {past.map(b => (
              <div key={b.id} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', opacity: '0.6', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>OWNER</p><p style={{ color: '#1a1008' }}>{b.owner_name}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>DOG</p><p style={{ color: '#1a1008' }}>{b.dog_name}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>BIRTHDAY</p><p style={{ color: '#1a1008' }}>{new Date(b.birthday).toLocaleDateString()}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>EMAIL SENT</p><p style={{ color: '#1a1008' }}>{b.last_discount_sent ? new Date(b.last_discount_sent).toLocaleDateString() : 'Pending'}</p></div>
                <div><p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600', marginBottom: '4px' }}>DISCOUNT</p><p style={{ color: '#c8973a', fontWeight: '600' }}>{b.discount_percent}%</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}