'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

export default function DogGalleryPage() {
  const [dogs, setDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchDogs(); }, []);
  async function fetchDogs() { setLoading(true); const { data } = await supabase.from('dog_gallery').select('*').order('created_at', { ascending: false }); setDogs(data || []); setLoading(false); }

  async function uploadMedia(file: File) {
    setUploading(true);
    const isVideo = file.type.startsWith('video');
    const name = `dogs/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '')}`;
    const { error } = await supabase.storage.from('product-images').upload(name, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) { alert('Upload failed: ' + error.message); return; }
    const url = `https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/${name}`;
    setEditing((prev: any) => prev ? { ...prev, media_url: url, media_type: isVideo ? 'video' : 'image' } : null);
  }

  async function save() {
    if (!editing?.media_url) { alert('Please upload a photo or video'); return; }
    const payload = { dog_name: editing.dog_name || '', breed: editing.breed || '', owner_name: editing.owner_name || '', location: editing.location || '', media_url: editing.media_url, media_type: editing.media_type || 'image', caption: editing.caption || '', is_featured: editing.is_featured ?? false, is_active: editing.is_active ?? true };
    if (editing.id) { await supabase.from('dog_gallery').update(payload).eq('id', editing.id); }
    else { await supabase.from('dog_gallery').insert(payload); }
    setEditing(null); fetchDogs();
  }

  async function remove(id: number) { if (confirm('Delete?')) { await supabase.from('dog_gallery').delete().eq('id', id); fetchDogs(); } }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Dog Gallery</h1><p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Photos & videos shown on the homepage</p></div>
        <button onClick={() => setEditing({ is_active: true, is_featured: false, media_type: 'image' })} style={{ padding: '10px 20px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>+ Add Photo/Video</button>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editing.id ? 'Edit' : 'Add'} Photo/Video</h2>

            <div style={{ marginBottom: 16 }}>
              {editing.media_url ? (
                <div style={{ position: 'relative' }}>
                  {editing.media_type === 'video' ?
                    <video src={editing.media_url} controls style={{ width: '100%', borderRadius: 6, maxHeight: 200 }} /> :
                    <img src={editing.media_url} style={{ width: '100%', borderRadius: 6, maxHeight: 200, objectFit: 'cover' }} />}
                  <button onClick={() => setEditing({ ...editing, media_url: '' })} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.7)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e5e7eb', borderRadius: 6, padding: '40px 20px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 32 }}>📷</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{uploading ? 'Uploading...' : 'Click to upload photo or video'}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>JPG, PNG, WebP, MP4 · Max 50MB</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadMedia(e.target.files[0]); }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Dog Name</label>
                <input value={editing.dog_name || ''} onChange={e => setEditing({ ...editing, dog_name: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Breed</label>
                <input value={editing.breed || ''} onChange={e => setEditing({ ...editing, breed: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Owner</label>
                <input value={editing.owner_name || ''} onChange={e => setEditing({ ...editing, owner_name: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Location</label>
                <input value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Caption</label>
              <input value={editing.caption || ''} onChange={e => setEditing({ ...editing, caption: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.is_featured ?? false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Featured on homepage</span>
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={save} style={{ padding: '10px 24px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 24px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
        {loading ? <p>Loading...</p> : dogs.map(d => (
          <div key={d.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {d.media_type === 'video' ?
              <video src={d.media_url} style={{ width: '100%', height: 180, objectFit: 'cover' }} /> :
              <img src={d.media_url} style={{ width: '100%', height: 180, objectFit: 'cover' }} />}
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{d.dog_name || 'Unnamed'} {d.is_featured && '⭐'}</div>
              {d.breed && <div style={{ fontSize: 11, color: '#6b7280' }}>{d.breed}</div>}
              {d.caption && <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{d.caption}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => setEditing(d)} style={{ padding: '4px 10px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                <button onClick={() => remove(d.id)} style={{ padding: '4px 10px', border: '1px solid #fecaca', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
