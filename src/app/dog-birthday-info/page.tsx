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
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DogBirthdayInfo() {
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
      setBirthdays((data as Birthday[]) || []);
    } catch (error) {
      console.error('Error fetching birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBirthdays = birthdays.filter(b =>
    b.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.dog_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search)
  );

  const upcomingBirthdays = filteredBirthdays.filter(b => {
    const today = new Date().toISOString().split('T')[0];
    return b.birthday >= today;
  });

  const pastBirthdays = filteredBirthdays.filter(b => {
    const today = new Date().toISOString().split('T')[0];
    return b.birthday < today;
  });

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '24px' }}>
        🎂 Dog Birthday Club
      </h1>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          placeholder="Search by owner name, dog name, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid #ede5d8',
            width: '300px',
            fontSize: '14px',
          }}
        />
        <button
          onClick={fetchBirthdays}
          style={{
            padding: '12px 24px',
            background: '#c8973a',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', color: '#1a1008', marginBottom: '16px' }}>
          📅 Upcoming Birthdays ({upcomingBirthdays.length})
        </h2>
        {upcomingBirthdays.length === 0 ? (
          <p style={{ color: '#7a6a5a' }}>No upcoming birthdays</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {upcomingBirthdays.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#fff',
                  border: '1px solid #ede5d8',
                  padding: '16px',
                  borderRadius: '4px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    OWNER
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008', fontWeight: '600' }}>
                    {b.owner_name}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    DOG NAME
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008', fontWeight: '600' }}>
                    {b.dog_name}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    BIRTHDAY
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008' }}>
                    {new Date(b.birthday + 'T00:00:00').toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    PHONE
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008' }}>{b.phone}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    DISCOUNT
                  </p>
                  <p style={{ fontSize: '14px', color: '#c8973a', fontWeight: '600' }}>
                    {b.discount_percent}% OFF
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: '20px', color: '#1a1008', marginBottom: '16px' }}>
          ✅ Past Birthdays ({pastBirthdays.length})
        </h2>
        {pastBirthdays.length === 0 ? (
          <p style={{ color: '#7a6a5a' }}>No past birthdays</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {pastBirthdays.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#fff',
                  border: '1px solid #ede5d8',
                  padding: '16px',
                  borderRadius: '4px',
                  opacity: '0.7',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    OWNER
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008', fontWeight: '600' }}>
                    {b.owner_name}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    DOG NAME
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008', fontWeight: '600' }}>
                    {b.dog_name}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    BIRTHDAY
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008' }}>
                    {new Date(b.birthday + 'T00:00:00').toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    EMAIL SENT
                  </p>
                  <p style={{ fontSize: '14px', color: '#1a1008' }}>
                    {b.last_discount_sent
                      ? new Date(b.last_discount_sent + 'T00:00:00').toLocaleDateString()
                      : 'Pending'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', fontWeight: '600' }}>
                    DISCOUNT
                  </p>
                  <p style={{ fontSize: '14px', color: '#c8973a', fontWeight: '600' }}>
                    {b.discount_percent}% OFF
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}