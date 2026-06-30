'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);
const STORAGE_URL = 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const imgRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const vidRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  }

  function startEdit(p: any) {
    const images = p.images || [];
    const videos = p.videos || [];
    const sizes = (p.sizes || []).map((s: any) => ({
      ...s,
      compare_price: s.compare_price || 0,
      cogs: s.cogs || 0,
      stock: s.stock || 0,
    }));
    setEditing({ ...p, images: [...images], videos: [...videos], sizes, compare_price: p.compare_price || (sizes[0]?.compare_price) || 0 });
  }

  function updateSize(idx: number, field: string, value: string) {
    const sizes = [...(editing.sizes || [])];
    sizes[idx] = { ...sizes[idx], [field]: field === 'label' ? value : (parseFloat(value) || 0) };
    if (sizes[idx].price && sizes[idx].cogs) {
      sizes[idx].margin = Math.round((1 - sizes[idx].cogs / sizes[idx].price) * 100);
    }
    setEditing({ ...editing, sizes });
  }

  async function uploadFile(file: File, type: 'image' | 'video', slotIdx: number) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const name = `${editing.id}/${type}-${slotIdx}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(name, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) { alert('Upload failed: ' + error.message); return; }
    const url = STORAGE_URL + name;
    if (type === 'image') {
      const imgs = [...(editing.images || [])];
      imgs[slotIdx] = url;
      setEditing({ ...editing, images: imgs, ...(slotIdx === 0 ? { image_url: url } : {}) });
    } else {
      const vids = [...(editing.videos || [])];
      vids[slotIdx] = url;
      setEditing({ ...editing, videos: vids });
    }
  }

  async function save() {
    if (!editing) return;
    const sizes = (editing.sizes || []).map((s: any) => ({
      label: s.label, price: s.price || 0, compare_price: s.compare_price || 0,
      cogs: s.cogs || 0, stock: s.stock || 0
    }));
    const payload: any = {
      name: editing.name,
      price: editing.price || sizes[0]?.price || 0,
      compare_price: editing.compare_price || sizes[0]?.compare_price || 0,
      cogs: editing.cogs || 0,
      stock: editing.stock || 0,
      reorder_level: editing.reorder_level || 10,
      best_before_days: editing.best_before_days || 365,
      is_active: editing.is_active ?? true,
      is_bestseller: editing.is_bestseller ?? false,
      sizes,
      images: editing.images || [],
      videos: editing.videos || [],
      image_url: editing.image_url || editing.images?.[0] || null,
    };
    await supabase.from('products').update(payload).eq('id', editing.id);
    setEditing(null);
    fetchProducts();
  }

  async function toggleActive(id: number, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
  }

  const filtered = products.filter(p => {
    if (filter === 'active' && !p.is_active) return false;
    if (filter === 'hidden' && p.is_active) return false;
    if (search) return p.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700 as const, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#c8973a' };
  const td = { padding: '10px 12px' };
  const input = { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: '100%' };
  const label = { fontSize: 11, fontWeight: 700 as const, textTransform: 'uppercase' as const, color: '#6b7280', display: 'block' as const, marginBottom: 4, letterSpacing: '.06em' };

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Products</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{products.length} products</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'active', 'hidden'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, background: filter === f ? '#1a1008' : '#f3f4f6', color: filter === f ? '#fff' : '#6b7280', border: 'none', borderRadius: 20, cursor: 'pointer' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? products.length : f === 'active' ? products.filter(p => p.is_active).length : products.filter(p => !p.is_active).length})
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, width: 220 }} />
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', overflow: 'auto', padding: '40px 20px' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 750, padding: 28, height: 'fit-content' }}>
            {/* Image Upload Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} onClick={() => imgRefs[i]?.current?.click()}
                  style={{ aspectRatio: '1', border: '2px dashed #e5e7eb', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#faf8f5', position: 'relative' }}>
                  {editing.images?.[i] ? (
                    <img src={editing.images[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                      <div style={{ fontSize: 24 }}>📷</div>
                      <div style={{ fontSize: 10, marginTop: 4 }}>{i === 0 ? 'Main Image' : `Image ${i + 1}`}</div>
                    </div>
                  )}
                  <input ref={imgRefs[i]} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'image', i); }} />
                </div>
              ))}
            </div>
            {/* Video Upload */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[0, 1].map(i => (
                <div key={i} onClick={() => vidRefs[i]?.current?.click()}
                  style={{ padding: '16px', border: '2px dashed #e5e7eb', borderRadius: 6, textAlign: 'center', cursor: 'pointer', background: '#faf8f5' }}>
                  {editing.videos?.[i] ? (
                    <video src={editing.videos[i]} style={{ width: '100%', maxHeight: 80, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>Add Video {i + 1}<br /><span style={{ fontSize: 10 }}>MP4, MOV, up to 50MB</span></div>
                  )}
                  <input ref={vidRefs[i]} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'video', i); }} />
                </div>
              ))}
            </div>

            {uploading && <div style={{ textAlign: 'center', padding: 8, color: '#c8973a', fontWeight: 600, fontSize: 13 }}>⏳ Uploading...</div>}

            <div style={{ ...label, fontSize: 12, color: '#c8973a', marginBottom: 12, letterSpacing: '.1em' }}>PRODUCT DETAILS</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><div style={label}>Product Name</div><input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} style={input} /></div>
              <div><div style={label}>Selling Price (₹)</div><input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} style={input} /></div>
              <div><div style={{ ...label, color: '#ef4444' }}>MRP (₹) <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>— shows as strikethrough</span></div><input type="number" value={editing.compare_price || ''} onChange={e => setEditing({ ...editing, compare_price: parseFloat(e.target.value) || 0 })} style={{ ...input, background: '#fff0f0', borderColor: '#fecaca' }} placeholder="Higher than sell price" /></div>
            </div>

            {editing.compare_price > editing.price && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                ✅ Website will show: <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>₹{editing.compare_price}</span> <strong>₹{editing.price}</strong> — {Math.round((1 - editing.price / editing.compare_price) * 100)}% OFF
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><div style={label}>Base COGS (₹)</div><input type="number" value={editing.cogs || ''} onChange={e => setEditing({ ...editing, cogs: parseFloat(e.target.value) || 0 })} style={input} /></div>
              <div><div style={label}>Stock</div><input type="number" value={editing.stock || ''} onChange={e => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })} style={input} /></div>
              <div><div style={label}>Reorder Level</div><input type="number" value={editing.reorder_level || ''} onChange={e => setEditing({ ...editing, reorder_level: parseInt(e.target.value) || 0 })} style={input} /></div>
              <div><div style={label}>Best Before (days)</div><input type="number" value={editing.best_before_days || ''} onChange={e => setEditing({ ...editing, best_before_days: parseInt(e.target.value) || 0 })} style={input} /></div>
            </div>

            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div onClick={() => setEditing({ ...editing, is_active: !editing.is_active })} style={{ width: 44, height: 24, borderRadius: 12, background: editing.is_active ? '#16a34a' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: editing.is_active ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Product Active</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div onClick={() => setEditing({ ...editing, is_bestseller: !editing.is_bestseller })} style={{ width: 44, height: 24, borderRadius: 12, background: editing.is_bestseller ? '#c8973a' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: editing.is_bestseller ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Bestseller</span>
              </label>
            </div>

            {/* SIZE PRICING WITH MRP */}
            <div style={{ ...label, fontSize: 12, color: '#c8973a', marginBottom: 12, letterSpacing: '.1em' }}>SIZE PRICING, MRP & STOCK</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20, background: '#faf8f5', borderRadius: 4 }}>
              <thead>
                <tr><th style={{ ...th, textAlign: 'left' }}>Size</th><th style={th}>MRP (₹)</th><th style={th}>Sell Price</th><th style={th}>COGS</th><th style={{ ...th, textAlign: 'center' }}>Margin</th><th style={th}>Stock</th></tr>
              </thead>
              <tbody>
                {(editing.sizes || []).map((s: any, i: number) => {
                  const margin = s.price && s.cogs ? Math.round((1 - s.cogs / s.price) * 100) : 0;
                  const disc = s.compare_price && s.price && s.compare_price > s.price ? Math.round((1 - s.price / s.compare_price) * 100) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{s.label}</td>
                      <td style={td}><input type="number" value={s.compare_price || ''} onChange={e => updateSize(i, 'compare_price', e.target.value)} placeholder="MRP" style={{ width: 75, padding: '6px 8px', border: '1px solid #fecaca', borderRadius: 4, fontSize: 13, background: '#fff0f0' }} /></td>
                      <td style={td}><input type="number" value={s.price || ''} onChange={e => updateSize(i, 'price', e.target.value)} style={{ width: 75, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }} /></td>
                      <td style={td}><input type="number" value={s.cogs || ''} onChange={e => updateSize(i, 'cogs', e.target.value)} placeholder="Cost" style={{ width: 70, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }} /></td>
                      <td style={{ ...td, textAlign: 'center' }}>{margin > 0 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>{margin}%</span> : '—'}</td>
                      <td style={td}><input type="number" value={s.stock || ''} onChange={e => updateSize(i, 'stock', e.target.value)} style={{ width: 60, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '12px 28px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
              <button onClick={save} style={{ padding: '12px 28px', background: '#c8973a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Save Product</button>
            </div>
          </div>
        </div>
      )}

      {/* Product table */}
      {loading ? <p style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading products...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ ...th, textAlign: 'left' }}>Product</th>
              <th style={{ ...th, textAlign: 'right' }}>MRP</th>
              <th style={{ ...th, textAlign: 'right' }}>Price</th>
              <th style={{ ...th, textAlign: 'center' }}>Stock</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
              <th style={{ ...th, textAlign: 'center' }}>Media</th>
              <th style={{ ...th, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const mrp = p.compare_price || p.sizes?.[0]?.compare_price || 0;
              const price = p.price || p.sizes?.[0]?.price || 0;
              const imgCount = (p.images || []).filter(Boolean).length;
              const vidCount = (p.videos || []).filter(Boolean).length;
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: p.is_active ? 1 : 0.5 }}>
                  <td style={{ ...td, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.image_url ? <img src={p.image_url} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> :
                      <div style={{ width: 40, height: 40, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🦴</div>}
                    <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{p.category}</div></div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', textDecoration: mrp > price ? 'line-through' : 'none', color: '#9ca3af' }}>{mrp > 0 ? `₹${mrp}` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>₹{price}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 600, color: (p.stock || 0) < (p.reorder_level || 10) ? '#ef4444' : '#374151' }}>{p.stock || 100}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: p.is_active ? '#dcfce7' : '#fee2e2', color: p.is_active ? '#16a34a' : '#ef4444' }}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 11, color: '#6b7280' }}>{imgCount} img {vidCount} vid</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => startEdit(p)} style={{ padding: '5px 14px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Edit</button>
                      <button onClick={() => toggleActive(p.id, p.is_active)}
                        style={{ padding: '5px 14px', border: '1px solid', borderColor: p.is_active ? '#fecaca' : '#bbf7d0', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: p.is_active ? '#ef4444' : '#16a34a' }}>
                        {p.is_active ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
