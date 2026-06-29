'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Blog {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string
  body: string | null
  cover_image: string | null
  read_time: string
  published_at: string
  is_published: boolean
  tags: string[] | null
  created_at: string
}

const CATEGORIES = ['Nutrition', 'Ingredients', 'Feeding Guide', 'Dental', 'Health', 'Puppy Guide', 'Storage', 'Training', 'General']

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Blog | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'General', excerpt: '', body: '',
    cover_image: '', read_time: '5 min read', is_published: false, tags: ''
  })

  useEffect(() => { fetchBlogs() }, [])

  async function fetchBlogs() {
    const { data } = await supabase
      .from('blogs')
      .select('*')
      .order('published_at', { ascending: false })
    setBlogs(data || [])
    setLoading(false)
  }

  function startCreate() {
    setEditing(null)
    setForm({ title: '', category: 'General', excerpt: '', body: '', cover_image: '', read_time: '5 min read', is_published: false, tags: '' })
    setCreating(true)
  }

  function startEdit(blog: Blog) {
    setCreating(false)
    setEditing(blog)
    setForm({
      title: blog.title,
      category: blog.category || 'General',
      excerpt: blog.excerpt || '',
      body: blog.body || '',
      cover_image: blog.cover_image || '',
      read_time: blog.read_time || '5 min read',
      is_published: blog.is_published,
      tags: (blog.tags || []).join(', ')
    })
  }

  async function saveBlog() {
    setSaving(true)
    const payload = {
      title: form.title,
      category: form.category,
      excerpt: form.excerpt,
      body: form.body || null,
      cover_image: form.cover_image || null,
      read_time: form.read_time,
      is_published: form.is_published,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      published_at: new Date().toISOString().split('T')[0],
    }

    if (editing) {
      await supabase.from('blogs').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('blogs').insert([payload])
    }
    setSaving(false)
    setEditing(null)
    setCreating(false)
    fetchBlogs()
  }

  async function togglePublished(blog: Blog) {
    await supabase.from('blogs').update({ is_published: !blog.is_published }).eq('id', blog.id)
    fetchBlogs()
  }

  async function deleteBlog(blog: Blog) {
    if (!confirm(`Delete "${blog.title}"? This cannot be undone.`)) return
    await supabase.from('blogs').delete().eq('id', blog.id)
    fetchBlogs()
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `blog-images/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
    if (error) { alert('Upload failed: ' + error.message); return }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setForm(f => ({ ...f, cover_image: data.publicUrl }))
  }

  const showForm = creating || editing

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b5d4f' }}>Loading blogs...</div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, background: '#f9f6f2', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1008' }}>Blog Management</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b5d4f' }}>{blogs.length} articles &middot; {blogs.filter(b => b.is_published).length} published</p>
        </div>
        <button onClick={startCreate} style={{ background: '#c8973a', color: '#fff', border: 'none', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>
          + New Article
        </button>
      </div>

      {/* Editor */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1008' }}>
            {editing ? 'Edit Article' : 'New Article'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Article title" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Excerpt / Summary</label>
            <textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} placeholder="Brief summary shown on blog cards" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Article Body (HTML)</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: 12 }} placeholder="<h3>Introduction</h3><p>Article content here...</p>" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Cover Image</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" accept="image/*" onChange={uploadImage} style={{ fontSize: 12 }} />
              </div>
              {form.cover_image && (
                <div style={{ marginTop: 8 }}>
                  <img src={form.cover_image} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4 }} />
                  <div style={{ fontSize: 10, color: '#9ca3af', wordBreak: 'break-all', marginTop: 4 }}>{form.cover_image.split('/').pop()}</div>
                </div>
              )}
              <input value={form.cover_image} onChange={e => setForm(f => ({ ...f, cover_image: e.target.value }))} style={{ ...inputStyle, marginTop: 6, fontSize: 11 }} placeholder="Or paste image URL" />
            </div>
            <div>
              <label style={labelStyle}>Read Time</label>
              <input value={form.read_time} onChange={e => setForm(f => ({ ...f, read_time: e.target.value }))} style={inputStyle} placeholder="5 min read" />
            </div>
            <div>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={inputStyle} placeholder="nutrition, guide, health" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
              <span style={{ fontWeight: 600, color: form.is_published ? '#166534' : '#6b5d4f' }}>
                {form.is_published ? '✓ Published' : 'Draft (not visible on website)'}
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveBlog} disabled={saving || !form.title} style={{ background: '#1a1008', color: '#fff', border: 'none', padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : editing ? 'Update Article' : 'Create Article'}
            </button>
            <button onClick={() => { setEditing(null); setCreating(false) }} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '10px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 6, color: '#6b5d4f' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Blog List */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafaf8' }}>
              {['', 'Title', 'Category', 'Read Time', 'Status', 'Published', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blogs.map(blog => (
              <tr key={blog.id} style={{ borderBottom: '1px solid #f9f6f2' }}>
                <td style={{ padding: '10px 14px', width: 50 }}>
                  {blog.cover_image ? (
                    <img src={blog.cover_image} alt="" style={{ width: 40, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                  ) : (
                    <div style={{ width: 40, height: 28, background: '#f3f4f6', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📝</div>
                  )}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#1a1008', lineHeight: 1.3 }}>{blog.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{blog.excerpt?.slice(0, 80)}...</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', fontWeight: 600, color: '#6b5d4f' }}>{blog.category}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{blog.read_time}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => togglePublished(blog)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, fontWeight: 700, border: 'none', cursor: 'pointer', background: blog.is_published ? '#dcfce7' : '#fef3c7', color: blog.is_published ? '#166534' : '#92400e' }}>
                    {blog.is_published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
                  {blog.published_at ? new Date(blog.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(blog)} style={actionBtnStyle}>Edit</button>
                    <button onClick={() => deleteBlog(blog)} style={{ ...actionBtnStyle, color: '#dc2626', borderColor: '#fecaca' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fafaf8', color: '#1a1008', fontFamily: 'inherit', boxSizing: 'border-box' }
const actionBtnStyle: React.CSSProperties = { fontSize: 11, padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6b5d4f' }
