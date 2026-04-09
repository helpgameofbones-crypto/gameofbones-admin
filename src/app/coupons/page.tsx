'use client';

interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  expiryDate: string;
  usagePerCustomer: number;
  usageLimit: number;
  active: boolean;
}

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [couponData, setCouponData] = useState({
    code: '',
    discountPercent: 10,
    expiryDate: '',
    usagePerCustomer: 1,
    usageLimit: 0,
    active: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase.from('coupons').select('*');
      if (error) throw error;
      setCoupons((data as Coupon[]) || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const handleCreateCoupon = async () => {
    if (!couponData.code || !couponData.expiryDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase.from('coupons').insert([couponData]);
      if (error) throw error;

      setCouponData({
        code: '',
        discountPercent: 10,
        expiryDate: '',
        usagePerCustomer: 1,
        usageLimit: 0,
        active: true
      });
      setShowModal(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert('Error creating coupon');
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase.from('coupons').update({ active }).eq('id', id);
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
              <input type="text" value={couponData.code} onChange={(e) => setCouponData({...couponData, code: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Discount %</label>
                <input type="number" min="1" max="100" value={couponData.discountPercent} onChange={(e) => setCouponData({...couponData, discountPercent: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Valid Until</label>
                <input type="date" value={couponData.expiryDate} onChange={(e) => setCouponData({...couponData, expiryDate: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Uses Per Customer</label>
                <input type="number" min="1" value={couponData.usagePerCustomer} onChange={(e) => setCouponData({...couponData, usagePerCustomer: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#3a3028', marginBottom: '8px', textTransform: 'uppercase' }}>Total Limit</label>
                <input type="number" min="0" value={couponData.usageLimit} onChange={(e) => setCouponData({...couponData, usageLimit: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 24px', background: '#ede5d8', color: '#1a1008', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Cancel</button>
              <button onClick={handleCreateCoupon} style={{ padding: '10px 24px', background: '#1a1008', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {coupons.map((coupon) => (
          <div key={coupon.id} style={{ background: '#fff', border: '1px solid #ede5d8', padding: '16px', borderRadius: '4px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', alignItems: 'center' }}>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>CODE</p><p style={{ color: '#1a1008', fontWeight: '600' }}>{coupon.code}</p></div>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>DISCOUNT</p><p style={{ color: '#c8973a', fontWeight: '600' }}>{coupon.discountPercent}%</p></div>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>PER CUSTOMER</p><p style={{ color: '#1a1008' }}>{coupon.usagePerCustomer}</p></div>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>TOTAL LIMIT</p><p style={{ color: '#1a1008' }}>{coupon.usageLimit || 'Unlimited'}</p></div>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>EXPIRES</p><p style={{ color: '#1a1008' }}>{new Date(coupon.expiryDate).toLocaleDateString()}</p></div>
            <div><p style={{ fontSize: '11px', color: '#3a3028', fontWeight: '600', marginBottom: '4px' }}>STATUS</p><p style={{ color: coupon.active ? '#2a7c6f' : '#c0392b' }}>{coupon.active ? 'Active' : 'Inactive'}</p></div>
            <div><button onClick={() => handleToggleCoupon(coupon.id, !coupon.active)} style={{ padding: '6px 12px', background: coupon.active ? '#c0392b' : '#2a7c6f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', width: '100%' }}>{coupon.active ? 'Deactivate' : 'Activate'}</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}