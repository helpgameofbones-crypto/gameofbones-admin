'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { authedFetch } from '@/app/lib/authedFetch';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface OrderItem extends Product {
  quantity: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ManualOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    paymentMethod: 'cash',
    transactionId: '',
    notes: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedItems([...selectedItems, { ...product, quantity: 1 }]);
    }
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: number) => {
    const updated = [...selectedItems];
    updated[index].quantity = quantity;
    setSelectedItems(updated);
  };

  // When gifting, the order is recorded at ₹0 — no payment ever changes hands.
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = isGift
    ? 0
    : Math.min(
        subtotal,
        Math.max(0, discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue)
      );
  const totalAmount = isGift ? 0 : Math.max(0, subtotal - discountAmount);

  function toggleGift(checked: boolean) {
    setIsGift(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, paymentMethod: 'gift', transactionId: '' }));
    } else if (formData.paymentMethod === 'gift') {
      setFormData(prev => ({ ...prev, paymentMethod: 'cash' }));
    }
  }

  const handleCreateOrder = async () => {
    if (!formData.customerName || !formData.customerPhone || selectedItems.length === 0) {
      alert('Please fill in customer details and select items');
      return;
    }

    setLoading(true);

    try {
      const notesWithGiftTag = isGift
        ? `[INFLUENCER / GIFT — NO CHARGE]${formData.notes ? ' ' + formData.notes : ''}`
        : formData.notes;

      const payload = {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        items: selectedItems.map(i => ({
          product_id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: isGift ? 0 : (i.price || 0)
        })),
        subtotal: isGift ? 0 : subtotal,
        discountType: isGift ? null : discountType,
        discountValue: isGift ? 0 : discountValue,
        discountAmount: isGift ? 0 : discountAmount,
        total: totalAmount,
        paymentMethod: isGift ? 'gift' : formData.paymentMethod,
        transactionId: isGift ? '' : formData.transactionId,
        notes: notesWithGiftTag
      };

      const response = await authedFetch('/api/manual-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        alert(isGift ? 'Gift order created — recorded at ₹0, no payment taken.' : 'Order created successfully!');
        setFormData({ customerName: '', customerEmail: '', customerPhone: '', paymentMethod: 'cash', transactionId: '', notes: '' });
        setSelectedItems([]);
        setIsGift(false);
        setDiscountType('percent');
        setDiscountValue(0);
      } else {
        alert('Error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create order: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', background: '#faf6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '32px' }}> Manual Order Entry</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', border: '1px solid #ede5d8' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1a1008' }}>Customer Details</h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Name (Required)</label>
            <input type="text" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Phone (Required)</label>
            <input type="text" value={formData.customerPhone} onChange={(e) => setFormData({...formData, customerPhone: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Email (Optional)</label>
            <input type="email" value={formData.customerEmail} onChange={(e) => setFormData({...formData, customerEmail: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }} />
          </div>

          <div style={{ marginTop: '20px', padding: '14px', background: isGift ? '#fef3e2' : '#faf6f0', border: isGift ? '1.5px solid #c8973a' : '1px solid #ede5d8', borderRadius: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isGift} onChange={(e) => toggleGift(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1008' }}>🎁 Influencer / Gift — No Charge</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Sends product free of cost. Order total is recorded as ₹0 — no payment collected.</div>
              </div>
            </label>
          </div>

          <h3 style={{ fontSize: '16px', marginTop: '24px', marginBottom: '16px', color: '#1a1008' }}>Payment Info</h3>

          <div style={{ marginBottom: '16px', opacity: isGift ? 0.5 : 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Payment Method</label>
            <select value={formData.paymentMethod} disabled={isGift} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
              {isGift && <option value="gift">Gift (No Charge)</option>}
            </select>
          </div>

          <div style={{ marginBottom: '16px', opacity: isGift ? 0.5 : 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Transaction ID</label>
            <input type="text" value={formData.transactionId} disabled={isGift} onChange={(e) => setFormData({...formData, transactionId: e.target.value})} placeholder={isGift ? 'Not applicable for gifts' : 'UPI ref, card last 4 digits, etc'} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }} />
          </div>

          <div style={{ marginBottom: '16px', opacity: isGift ? 0.5 : 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Discount (Optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
              <select
                value={discountType}
                disabled={isGift}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'amount')}
                style={{ padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }}
              >
                <option value="percent">% Off</option>
                <option value="amount">₹ Off</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue || ''}
                disabled={isGift}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 100'}
                style={{ padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }}
              />
            </div>
            {!isGift && discountAmount > 0 && (
              <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '6px' }}>
                Discount applied: -₹{discountAmount.toFixed(2)}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Notes {isGift && '(e.g. Instagram handle, campaign name)'}</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder={isGift ? '@influencer_handle, campaign name, etc' : 'Event name, referral source, etc'} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', minHeight: '80px', fontFamily: 'inherit', color: '#1a1008' }} />
          </div>
        </div>

        <div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', border: '1px solid #ede5d8', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#1a1008' }}>Add Products</h2>
            <div style={{ display: 'grid', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {products.map(p => (
                <button key={p.id} onClick={() => addItem(p.id)} style={{ padding: '12px', background: '#faf6f0', border: '1px solid #ede5d8', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#1a1008' }}>
                  {p.name} - {p.price}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', border: '1px solid #ede5d8' }}>
          
