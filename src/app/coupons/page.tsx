'use client';

interface Coupon {
  id: string;
  code: string;
  type: string | null;          // 'percent' | 'fixed' | 'free' | 'shipping'
  value: number | null;
  min_order: number | null;
  valid_until: string | null;
  usagepercustomer: number | null;
  max_uses: number | null;
  is_active: boolean | null;
}

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function discountLabel(c: Coupon) {
  if (c.type === 'percent') return `${c.value ?? 0}%`;
  if (c.type === 'free') return 'Free item';
  if (c.type === 'shipping') return 'Free ship';
  return `₹${c.value ?? 0}`; // fixed
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  // Live usage counts, keyed by coupon code — computed from actual orders
  // rather than trusting a stored counter, since nothing in this codebase
  // ever incremented one. This also matches how the storefront's checkout
  // itself checks max_uses (see index.html applyDiscount()), so the number
  // shown here is always the same one actually being enforced.
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [couponData, setCouponData] = useState({
    code: '',
    type: 'percent',
    value: 10,
    min_order: 0,
    valid_until: '',
    usagepercustomer: 1,
    max_uses: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data as Coupon[]) || [];
      setCoupons(list);

      // Count real usage per code from the orders table.
      const { data: orderRows } = await supabase
        .from('orders')
        .select('coupon_code')
        .not('coupon_code', 'is', null);
      const counts: Record<string, number> = {};
      (orderRows || []).forEach((o: any) => {
        if (!o.coupon_code) return;
        counts[o.coupon_code] = (counts[o.coupon_code] || 0) + 1;
      });
      setUsageCounts(counts);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const handleCreateCoupon = async () => {
    if (!couponData.code) {
      alert('Please enter a coupon code');
      return;
    }
    try {
      const payload = {
        code: couponData.code.trim().toUpperCase(),
        type: couponData.type,
        value: couponData.value,
        min_order: couponData.min_order || null,
        valid_until: couponData.valid_until || null,
        usagepercustomer: couponData.usagepercustomer,
        max_uses: couponData.max_uses || null,
        is_active: couponData.is_active,
      };
      const { error } = await supabase.from('coupons').insert([payload]);
      if (error) throw error;

      setCouponData({
        code: '', type: 'percent', value: 10, min_order: 0,
        valid_until: '', usagepercustomer: 1, max_uses: 0, is_active: true,
      });
      setShowModal(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert('Error creating coupon');
    }
  };

  const handleToggleCoupon = async (id: string, is_active: boolean) => {
    try {
      const { error } = await supabase.from('coupons').update({ is_active }).eq('id', id);
      if (error) throw error;
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling coupon:', error);
      alert('Error updating coupon');
    }
  };

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '32px', color: '#1a1008', margin: 0 }}>Coupons</h1>
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#c8973a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          + Create Coupon
        </button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', maxWidth: '600px', width: '100%' }}>
            <h2 style={{ fontSize: '24px', color: '#1a1008', marginBottom: '24px' }}>Create Coupon</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Coupon Code</label>
              <input type="text" value={couponData.code} onChange={(e) => setCouponData({ ...couponData, code: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Type</label>
                <select value={couponData.type} onChange={(e) => setCouponData({ ...couponData, type: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                  <option value="shipping">Free Shipping</option>
                  <option value="free">Free Item</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Value</label>
                <input type="number" min="0" value={couponData.value} onChange={(e) => setCouponData({ ...couponData, value: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Min Order (₹)</label>
                <input type="number" min="0" value={couponData.min_order} onChange={(e) => setCouponData({ ...couponData, min_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Valid Until</label>
                <input type="date" value={couponData.valid_until} onChange={(e) => setCouponData({ ...couponData, valid_until: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Uses Per Customer</label>
                <input type="number" min="1" value={couponData.usagepercustomer} onChange={(e) => setCouponData({ ...couponData, usagepercustomer: parseInt(e.target.value) || 1 })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Total Limit (0 = unlimited)</label>
                <input type="number" min="0" value={couponData.max_uses} onChange={(e) => setCouponData({ ...couponData, max_uses: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 24px', background: '#ede5d8', color: '#1a1008', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Cancel</button>
              <button onClick={handleCreateCoupon} style={{ padding: '10px 24px', background: '#1a1008', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Header row so the grid below is self-explanatory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '12px', padding: '0 16px', marginBottom: '8px' }}>
        {['CODE', 'DISCOUNT', 'MIN ORDER', 'PER CUSTOMER', 'TOTAL USED / CAP', 'EXPIRES', 'STATUS', ''].map(h => (
          <p key={h} style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', letterSpacing: '.06em', margin: 0 }}>{h}</p>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {coupons.map((coupon) => (
          <div key={coupon.id} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', borderRadius: '4px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '12px', alignItems: 'center' }}>
            <div><p style={{ color: '#1a1008', fontWeight: '600', margin: 0 }}>{coupon.code}</p></div>
            <div><p style={{ color: '#c8973a', fontWeight: '600', margin: 0 }}>{discountLabel(coupon)}</p></div>
            <div><p style={{ color: '#1a1008', margin: 0 }}>{coupon.min_order ? `₹${coupon.min_order}` : '—'}</p></div>
            <div>
              <p style={{ color: coupon.usagepercustomer ? '#1a1008' : '#9ca3af', fontWeight: coupon.usagepercustomer ? 600 : 400, margin: 0 }}>
                {coupon.usagepercustomer ? `${coupon.usagepercustomer}× per customer` : 'Unlimited per customer'}
              </p>
            </div>
            <div><p style={{ color: '#1a1008', margin: 0 }}>{usageCounts[coupon.code] ?? 0} / {coupon.max_uses || '∞ (no overall cap)'}</p></div>
            <div><p style={{ color: '#1a1008', margin: 0 }}>{coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : 'No expiry'}</p></div>
            <div><p style={{ color: coupon.is_active ? '#2a7c6f' : '#c0392b', margin: 0 }}>{coupon.is_active ? 'Active' : 'Inactive'}</p></div>
            <div><button onClick={() => handleToggleCoupon(coupon.id, !coupon.is_active)} style={{ padding: '6px 12px', background: coupon.is_active ? '#c0392b' : '#2a7c6f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', width: '100%' }}>{coupon.is_active ? 'Deactivate' : 'Activate'}</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
