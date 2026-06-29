'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

interface Blog {
  id: number; title: string; slug: string; category: string; excerpt: string;
  body: string; cover_image: string; read_time: number; is_published: boolean;
  tags: string[]; created_at: string;
}

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Blog> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchBlogs(); }, []);

  async function fetchBlogs() {
    setLoading(true);
    const { data } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    setBlogs(data || []);
    setLoading(false);
  }

  async function handleImageUpload(file: File) {
    if (!file || file.size > 5 * 1024 * 1024) { alert('File must be under 5MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `blog-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('product-images').upload(`blogs/${fileName}`, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) { alert('Upload failed: ' + error.message); return; }
    const url = `https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/blogs/${fileName}`;
    setEditing(prev => prev ? { ...prev, cover_image: url } : null);
  }

  async function saveBlog() {
    if (!editing?.title) { alert('Title is required'); return; }
    const slug = editing.slug || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const payload = {
      title: editing.title, slug, category: editing.category || 'General',
      excerpt: editing.excerpt || '', body: editing.body || '', cover_image: editing.cover_image || '',
      read_time: editing.read_time || 3, is_published: editing.is_published ?? true,
      tags: editing.tags || []
    };

    if (editing.id) {
      await supabase.from('blogs').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('blogs').insert(payload);
    }
    setEditing(null);
    fetchBlogs();
  }

  async function deleteBlog(id: number) {
    if (!confirm('Delete this blog post?')) return;
    await supabase.from('blogs').delete().eq('id', id);
    fetchBlogs();
  }

  async function togglePublish(id: number, current: boolean) {
    await supabase.from('blogs').update({ is_published: !current }).eq('id', id);
    setBlogs(prev => prev.map(b => b.id === id ? { ...b, is_published: !current } : b));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Blog Management</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{blogs.length} articles</p>
        </div>
        <button onClick={() => setEditing({ is_published: true, category: 'Nutrition', read_time: 3, tags: [] })}
          style={{ padding: '10px 20px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          + New Article
        </button>
      </div>

      {/* Editor modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editing.id ? 'Edit Article' : 'New Article'}</h2>

            {/* Cover image upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Cover Image</label>
              {editing.cover_image ? (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <img src={editing.cover_image} alt="Cover" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                  <button onClick={() => setEditing({ ...editing, cover_image: '' })}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.7)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #e5e7eb', borderRadius: 6, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>{uploading ? 'Uploading...' : 'Click to upload cover image'}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>PNG, JPG, WebP · Max 5MB</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Title</label>
                <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Category</label>
                <select value={editing.category || 'Nutrition'} onChange={e => setEditing({ ...editing, category: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }}>
                  {['Nutrition', 'Feeding Guide', 'Ingredients', 'Health', 'Dental', 'Puppy Guide', 'Storage', 'Training'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Excerpt</label>
              <textarea value={editing.excerpt || ''} onChange={e => setEditing({ ...editing, excerpt: e.target.value })} rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Body (HTML)</label>
              <textarea value={editing.body || ''} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={10}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 4 }}>Read Time (min)</label>
                <input type="number" value={editing.read_time || 3} onChange={e => setEditing({ ...editing, read_time: parseInt(e.target.value) || 3 })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing.is_published ?? true} onChange={e => setEditing({ ...editing, is_published: e.target.checked })} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Published</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={saveBlog}
                style={{ padding: '10px 24px', background: '#1a1008', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
                {editing.id ? 'Save Changes' : 'Create Article'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{ padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blog list */}
      {loading ? <p>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blogs.map(b => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
              {b.cover_image ? (
                <img src={b.cover_image} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 120, height: 80, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>📝</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#c8973a' }}>{b.category}</span>
                  {!b.is_published && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>DRAFT</span>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{b.excerpt?.slice(0, 100)}{b.excerpt && b.excerpt.length > 100 ? '...' : ''}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{b.read_time} min read · {new Date(b.created_at).toLocaleDateString('en-IN')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => togglePublish(b.id, b.is_published)}
                  style={{ padding: '6px 12px', border: '1px solid #e5e7eb', background: b.is_published ? '#dcfce7' : '#f3f4f6', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  {b.is_published ? '✓ Published' : 'Publish'}
                </button>
                <button onClick={() => setEditing(b)}
                  style={{ padding: '6px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Edit</button>
                <button onClick={() => deleteBlog(b.id)}
                  style={{ padding: '6px 12px', border: '1px solid #fecaca', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
