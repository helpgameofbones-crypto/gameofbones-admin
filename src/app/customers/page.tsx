'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

// Orders store phone/email encrypted with a simple XOR cipher. Grouping
// customers MUST decrypt first — grouping on the raw encrypted string (or
// stripping digits from it) silently breaks customer matching entirely,
// which is why this page used to show gibberish and miscounted customers.
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan';
function decryptData(encrypted) {
  if (!encrypted) return '';
  try {
    const binary = atob(encrypted);
    let result = '';
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}
function decryptPhone(raw) {
  if (!raw) return '';
  if (/^\+?\d{10,13}$/.test(raw)) return raw;
  const dec = decryptData(raw);
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw;
}
function decryptEmail(raw) {
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const dec = decryptData(raw);
  return dec.includes('@') ? dec : raw;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalValue');

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data: orders } = await supabase
      .from('orders').select('*').order('created_at', { ascending: false });
    if (!orders) { setLoading(false); return; }

    const map = new Map();
    orders.forEach((o) => {
      const decryptedPhone = decryptPhone(o.customer_phone || '');
      const phone = decryptedPhone.replace(/\D/g, '').slice(-10);
      if (!phone) return;
      const decryptedEmail = decryptEmail(o.customer_email || '');
      if (!map.has(phone)) {
        map.set(phone, {
          phone, name: o.customer_name || '', email: decryptedEmail,
          totalOrders: 0, totalValue: 0, lastOrderDate: o.created_at,
          orders: [], couponsUsed: [], avgOrderValue: 0
        });
      }
      const c = map.get(phone);
      c.totalOrders++;
      c.totalValue += o.grand_total || o.total_amount || 0;
      if (!c.name && o.customer_name) c.name = o.customer_name;
      if (!c.email && decryptedEmail) c.email = decryptedEmail;
      if (o.coupon_code && !c.couponsUsed.includes(o.coupon_code)) c.couponsUsed.push(o.coupon_code);
      c.orders.push(o);
    });

    const arr = Array.from(map.values());
    arr.forEach(c => { c.avgOrderValue = c.totalOrders > 0 ? Math.round(c.totalValue / c.totalOrders) : 0; });
    setCustomers(arr);
    setLoading(false);
  }

  const sorted = [...customers]
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (sortBy === 'totalValue') return b.totalValue - a.totalValue;
      if (sortBy === 'totalOrders') return b.totalOrders - a.totalOrders;
      return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
    });

  const totalRevenue = customers.reduce((s, c) => s + c.totalValue, 0);
  const avgLTV = customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0;
  const repeatCustomers = customers.filter(c => c.totalOrders > 1).length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Customers</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{customers.length} unique customers</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Customers', value: customers.length, color: '#1a1008' },
          { label: 'Total Revenue', value: '₹' + totalRevenue.toLocaleString('en-IN'), color: '#16a34a' },
          { label: 'Avg Lifetime Value', value: '₹' + avgLTV.toLocaleString('en-IN'), color: '#c8973a' },
          { label: 'Repeat Customers', value: `${repeatCustomers} (${customers.length > 0 ? Math.round(repeatCustomers / customers.length * 100) : 0}%)`, color: '#8b5cf6' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9ca3af', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color, fontFamily: 'Georgia, serif' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email..."
          style={{ flex: 1, maxWidth: 350, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}>
          <option value="totalValue">Sort by Total Spent</option>
          <option value="totalOrders">Sort by Order Count</option>
          <option value="lastOrderDate">Sort by Last Order</option>
        </select>
      </div>

      {loading ? <p>Loading customers...</p> : (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Orders</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Spent</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Avg Order</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Last Order</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Coupons</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.phone} onClick={() => setSelected(c)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected && selected.phone === c.phone ? '#fffbeb' : '' }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{c.name || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>📱 {c.phone}</div>
                      {c.email && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.email}</div>}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>{c.totalOrders}</td>
                    <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{c.totalValue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: 12, textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>₹{c.avgOrderValue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>{new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: 12 }}>
                      {c.couponsUsed.length > 0 ? c.couponsUsed.map(code => (
                        <span key={code} style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 6px', marginRight: 4, borderRadius: 4 }}>{code}</span>
                      )) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div style={{ width: 380, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.name || 'Unknown'}</h3>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Total Spent</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>₹{selected.totalValue.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af' }}>Orders</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{selected.totalOrders}</div>
                </div>
              </div>

              <div style={{ background: '#f9fafb', padding: 14, borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Contact</div>
                <div style={{ fontSize: 13 }}>📱 {selected.phone}</div>
                {selected.email && <div style={{ fontSize: 13 }}>📧 {selected.email}</div>}
                <a href={`https://wa.me/91${selected.phone}`} target="_blank" style={{ fontSize: 12, color: '#25d366', fontWeight: 600, display: 'inline-block', marginTop: 8 }}>WhatsApp →</a>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Order History</div>
              {selected.orders.map((o, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>#{o.ref} — ₹{(o.grand_total || o.total_amount || 0).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                    background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                    color: o.status === 'delivered' ? '#16a34a' : o.status === 'cancelled' ? '#ef4444' : '#92400e' }}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
