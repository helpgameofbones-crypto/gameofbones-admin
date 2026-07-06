'use client';
import { useState, useEffect, type CSSProperties } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

const LOGO_URL = 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/logo.jpeg';

const COMPANY = {
  name: 'Game of Bones',
  addressLines: ['5 Shree Kedar Apartment, Rambaug lane no 5', 'Kalyan West', 'Maharashtra, India', 'Pincode: 421301'],
  phone: '9082503295',
  email: 'helpgameofbones@gmail.com',
  website: 'gameofbones.in',
};

// ── Decryption (same XOR cipher the storefront uses) ────────────────────
const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan';
function decryptData(encrypted: string): string {
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
function decryptPhone(raw: string): string {
  if (!raw) return '';
  if (/^\+?\d{10,13}$/.test(raw)) return raw;
  const dec = decryptData(raw);
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw;
}
function decryptEmail(raw: string): string {
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const dec = decryptData(raw);
  return dec.includes('@') ? dec : raw;
}
function decryptAddressField(raw: string): string {
  if (!raw) return '';
  const dec = decryptData(raw);
  const printable = dec.replace(/[\x20-\x7E]/g, '').length;
  return printable / Math.max(dec.length, 1) > 0.3 ? raw : dec;
}

function parseItems(items: any): { name: string; sku: string; qty: number; price: number; mrp: number }[] {
  if (!items) return [];
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { return []; } }
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => ({
    name: it.name || it.product_name || 'Item',
    sku: it.sku || it.product_id || '—',
    qty: it.quantity || it.qty || 1,
    price: it.price || it.pack_price || 0,
    mrp: it.mrp || it.compare_price || 0,
  }));
}

// FIX: some orders (older/seed data) store the street under `address` or
// `line1` instead of `street` — check all the shapes we've actually seen in
// the database before falling back to blank, and only decrypt whichever
// value we find.
function formatAddress(addr: any): string[] | null {
  if (!addr) return null;
  if (typeof addr === 'string') { try { addr = JSON.parse(addr); } catch { return null; } }
  if (typeof addr !== 'object') return null;
  const streetRaw = addr.street || addr.address || addr.line1 || addr.address_line1 || '';
  const street = decryptAddressField(streetRaw);
  const parts = [street, addr.city, addr.state, addr.pincode].filter(Boolean);
  return parts.length ? parts : null;
}

export default function InvoicesPage() {
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<any>(null);

  useEffect(() => { fetchAllOrders(); }, []);

  async function fetchAllOrders() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, ref, customer_name, customer_phone, customer_email, grand_total, total_amount, created_at, status, items, shipping_address, subtotal, discount, shipping, coupon_code, notes, transaction_id, payment_method')
      .order('created_at', { ascending: false })
      .limit(500);
    setLoadingList(false);
    if (error) { console.error(error); return; }
    const decrypted = (data || []).map((o: any) => ({
      ...o,
      customer_phone: decryptPhone(o.customer_phone),
      customer_email: decryptEmail(o.customer_email),
    }));
    setAllOrders(decrypted);
    if (decrypted.length > 0) setOrder(decrypted[0]);
  }

  const filteredOrders = allOrders.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (o.ref || '').toLowerCase().includes(s) ||
      (o.customer_name || '').toLowerCase().includes(s) ||
      (o.customer_phone || '').includes(s);
  });

  function printInvoice() {
    window.print();
  }

  const items = order ? parseItems(order.items) : [];
  const addrLines = order ? formatAddress(order.shipping_address) : null;
  const subtotal = order ? (parseFloat(order.subtotal) || items.reduce((s, i) => s + i.price * i.qty, 0)) : 0;
  const discount = order ? (parseFloat(order.discount) || 0) : 0;
  const shipping = order ? (parseFloat(order.shipping) || 0) : 0;
  const grandTotal = order ? (parseFloat(order.grand_total) || parseFloat(order.total_amount) || 0) : 0;
  const orderDate = order ? new Date(order.created_at).toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '') : '';

  const customerBlock = order ? (
    <>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{order.customer_name || '—'}</div>
      {order.customer_email && <div>{order.customer_email}</div>}
      {addrLines ? addrLines.map((l, i) => <div key={i}>{l}</div>) : null}
      {order.customer_phone && <div>+91 {order.customer_phone.slice(-10)}</div>}
    </>
  ) : null;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Invoices</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{allOrders.length} orders — search or scroll to find one, click to generate its invoice</p>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{ width: 340, flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ref, name, or phone..."
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, maxHeight: 640, overflowY: 'auto', background: '#fff' }}>
            {loadingList ? (
              <div style={{ padding: 20, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>No orders match your search.</div>
            ) : (
              filteredOrders.map(o => {
                const isSelected = order && order.id === o.id;
                const amount = o.grand_total || o.total_amount || 0;
                return (
                  <div key={o.id} onClick={() => setOrder(o)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                      background: isSelected ? '#fff9f0' : '#fff',
                      borderLeft: isSelected ? '3px solid #c8973a' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1008' }}>{o.ref}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{o.customer_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {o.discount > 0 && <span style={{ color: '#c8973a', fontWeight: 700 }}> · -₹{o.discount} off</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {order && (
          <div style={{ paddingTop: 4 }}>
            <button onClick={printInvoice}
              style={{ padding: '10px 24px', background: '#c8973a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
              🖨️ Print / Save as PDF
            </button>
          </div>
        )}
      </div>

      {order && (
        <div id="invoice-print" style={{ background: '#fff', padding: 48, border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'Arial, sans-serif', color: '#1a1a1a', maxWidth: 900 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <img src={LOGO_URL} alt="Game of Bones" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6 }} />
            <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{COMPANY.name}</div>
              {COMPANY.addressLines.map((l, i) => <div key={i}>{l}</div>)}
              <div>{COMPANY.phone}</div>
              <div>{COMPANY.email}</div>
              <div>{COMPANY.website}</div>
            </div>
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 20, letterSpacing: '.02em' }}>INVOICE</h1>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>Order Number</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>#{order.ref}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>Order Date</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{orderDate}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>Payment Method</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{(order.payment_method || 'razorpay').toUpperCase()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {['Shipping Details', 'Billing Details'].map((title, i) => (
              <div key={i}>
                <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#374151', marginBottom: 10, textAlign: 'center' }}>
                  {title}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#374151' }}>{customerBlock}</div>
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1a1a1a' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Item</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>SKU</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Qty</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Tax</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 6px', fontSize: 13, fontWeight: 600 }}>{it.name}</td>
                  <td style={{ padding: '10px 6px', fontSize: 12, color: '#6b7280' }}>{it.sku !== '—' ? String(it.sku).slice(0, 12) : '—'}</td>
                  <td style={{ padding: '10px 6px', fontSize: 13, textAlign: 'center' }}>x{it.qty}</td>
                  <td style={{ padding: '10px 6px', fontSize: 13, textAlign: 'center' }}>0%</td>
                  <td style={{ padding: '10px 6px', fontSize: 13, textAlign: 'right' }}>
                    {it.mrp && it.mrp > it.price ? (
                      <>
                        <div style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: 11 }}>₹{it.mrp.toFixed(2)}</div>
                        <div>₹{it.price.toFixed(2)}</div>
                      </>
                    ) : <div>₹{it.price.toFixed(2)}</div>}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>₹{(it.price * it.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <table style={{ width: 320, borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={rowLabel}>Sub Total</td><td style={rowVal}>₹{subtotal.toFixed(2)}</td></tr>
                {discount > 0 && (
                  <tr>
                    <td style={rowLabel}>
                      Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}
                      {order.notes && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{order.notes}</div>}
                    </td>
                    <td style={{ ...rowVal, color: '#16a34a' }}>- ₹{discount.toFixed(2)}</td>
                  </tr>
                )}
                <tr><td style={rowLabel}>Shipping</td><td style={rowVal}>{shipping > 0 ? '₹' + shipping.toFixed(2) : 'FREE'}</td></tr>
                <tr style={{ borderTop: '1px solid #d1d5db' }}><td style={{ ...rowLabel, fontWeight: 700 }}>Total</td><td style={{ ...rowVal, fontWeight: 700 }}>₹{grandTotal.toFixed(2)}</td></tr>
                <tr><td style={rowLabel}>Amount Paid</td><td style={rowVal}>₹{grandTotal.toFixed(2)}</td></tr>
                <tr style={{ borderTop: '1px solid #d1d5db' }}><td style={{ ...rowLabel, fontWeight: 700 }}>Balance Due</td><td style={{ ...rowVal, fontWeight: 700 }}>₹0.00</td></tr>
              </tbody>
            </table>
          </div>

          {order.transaction_id && (
            <div style={{ marginTop: 16, fontSize: 11, color: '#9ca3af' }}>Transaction ID: {order.transaction_id}</div>
          )}

          <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Thank you for your continued partnership.</div>
            <p style={{ fontSize: 11, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              We appreciate your business and the trust you've placed in us. We're committed to keeping your experience at the highest level, and we look forward to serving you again in the future.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const rowLabel: CSSProperties = { padding: '6px 8px', fontSize: 13, color: '#374151' };
const rowVal: CSSProperties = { padding: '6px 8px', fontSize: 13, textAlign: 'right', color: '#1a1a1a' };
