'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCreateOrder = async () => {
    console.log('Create Order clicked');
    console.log('Form data:', formData);
    console.log('Selected items:', selectedItems);

    if (!formData.customerName || !formData.customerPhone || selectedItems.length === 0) {
      alert('Please fill in customer details and select items');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        items: selectedItems.map(i => ({ 
          product_id: i.id, 
          name: i.name, 
          quantity: i.quantity, 
          price: i.price || 0
        })),
        total: totalAmount,
        paymentMethod: formData.paymentMethod,
        transactionId: formData.transactionId,
        notes: formData.notes
      };

      console.log('Sending payload:', payload);

      const response = await fetch('/api/manual-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response result:', result);

      if (result.success) {
        alert('Order created successfully!');
        setFormData({ customerName: '', customerEmail: '', customerPhone: '', paymentMethod: 'cash', transactionId: '', notes: '' });
        setSelectedItems([]);
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
      <h1 style={{ fontSize: '32px', color: '#1a1008', marginBottom: '32px' }}>📝 Manual Order Entry</h1>

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

          <h3 style={{ fontSize: '16px', marginTop: '24px', marginBottom: '16px', color: '#1a1008' }}>Payment Info</h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Payment Method</label>
            <select value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Transaction ID</label>
            <input type="text" value={formData.transactionId} onChange={(e) => setFormData({...formData, transactionId: e.target.value})} placeholder="UPI ref, card last 4 digits, etc" style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', color: '#1a1008' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#2a1f1a', marginBottom: '8px', textTransform: 'uppercase' }}>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Event name, referral source, etc" style={{ width: '100%', padding: '10px', border: '1px solid #ede5d8', fontSize: '14px', minHeight: '80px', fontFamily: 'inherit', color: '#1a1008' }} />
          </div>
        </div>

        <div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', border: '1px solid #ede5d8', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#1a1008' }}>Add Products</h2>
            <div style={{ display: 'grid', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {products.map(p => (
                <button key={p.id} onClick={() => addItem(p.id)} style={{ padding: '12px', background: '#faf6f0', border: '1px solid #ede5d8', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#1a1008' }}>
                  {p.name} - ₹{p.price}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', border: '1px solid #ede5d8' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#1a1008' }}>Order Items ({selectedItems.length})</h2>
            {selectedItems.length === 0 ? (
              <p style={{ color: '#3a3028', fontSize: '14px' }}>No items selected</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                {selectedItems.map((item, i) => (
                  <div key={i} style={{ padding: '12px', background: '#faf6f0', display: 'grid', gridTemplateColumns: '1fr 80px 50px', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                    <div><p style={{ fontWeight: '600', margin: 0, color: '#1a1008' }}>{item.name}</p><p style={{ color: '#3a3028', margin: '4px 0 0 0' }}>₹{item.price}</p></div>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateQuantity(i, parseInt(e.target.value) || 1)} style={{ padding: '6px', border: '1px solid #ede5d8', fontSize: '13px', color: '#1a1008' }} />
                    <button onClick={() => removeItem(i)} style={{ padding: '6px', background: '#c0392b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '2px solid #ede5d8', paddingTop: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#2a1f1a', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Total</p>
              <p style={{ fontSize: '28px', fontWeight: '700', color: '#c8973a', margin: 0 }}>₹{totalAmount.toFixed(2)}</p>
            </div>

            <button onClick={handleCreateOrder} disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#999' : '#1a1008', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
