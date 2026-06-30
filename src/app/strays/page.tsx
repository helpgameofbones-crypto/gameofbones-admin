'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

export default function StraysPage() {
  const [strays, setStrays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch(); }, []);
  async function fetch() { setLoading(true); const { data } = await supabase.from('strays').select('*').order('created_at'); setStrays(data || []); setLoading(false); }

  async function uploadImage(file: File) {
    if (!file) return '';
    setUploading(true);
    const name = `strays/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '')}`;
    const { error } = await supabase.storage.from('product-images').upload(name, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) { alert('Upload failed: ' + error.message); return ''; }
    return `https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/${name}`;
  }

  async function handleFiles(files: FileList) {
    const urls: string[] = [...(editing?.images || [])];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i]);
      if (url) urls.push(url);
    }
    setEditing({ ...editing, images: urls });
  }

  async function save() {
    if (!editing?.name) { alert('Name required'); return; }
    const payload = { name: editing.name, location: editing.location || '', description: editing.description || '', images: editing.images || [], is_active: editing.is_active ?? true };
    if (editing.id) { await supabase.from('strays').update(payload).eq('id', editing.id); }
    else { await supabase.from('strays').insert(payload); }
    setEditing(null); fetch();
  }

  async function remove(id: number) { if (confirm('Delete?')) { await supabase.from('strays').delete().eq('id', id); fetch(); } }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Strays We Feed</h1><p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Manage stray dogs shown on the website</p></div>
        <button onClick={() => setEditing({ is_active: true, images: [] })} style={{ padding: '10px 20px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>+ Add Dog</button>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editing.id ? 'Edit' : 'Add'} Dog</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Name</label>
                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Location</label>
                <input value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, resize: 'vertical' }} /></div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 8 }}>Photos (multiple)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {(editing.images || []).map((url: string, i: number) => (
                  <div key={i} style={{ position: 'relative', width: 100, height: 100 }}>
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    <button onClick={() => setEditing({ ...editing, images: editing.images.filter((_: any, j: number) => j !== i) })}
                      style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <div onClick={() => fileRef.current?.click()} style={{ width: 100, height: 100, border: '2px dashed #e5e7eb', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#9ca3af' }}>
                  {uploading ? '⏳' : '+'}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) handleFiles(e.target.files); }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={save} style={{ padding: '10px 24px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 24px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p>Loading...</p> : strays.map(s => (
        <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {(s.images || []).slice(0, 3).map((url: string, i: number) => (
              <img key={i} src={url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
            ))}
            {(!s.images || s.images.length === 0) && <div style={{ width: 60, height: 60, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🐕</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#c8973a' }}>{s.location}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(s)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
            <button onClick={() => remove(s.id)} style={{ padding: '6px 12px', border: '1px solid #fecaca', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
