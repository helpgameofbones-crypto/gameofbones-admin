'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_IMAGES = 5
const MAX_VIDEOS = 2

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', price: '', stock: '100', sku: '', category: '', description: '' })

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  function openEdit(p: any) {
    setEditing({
      ...p,
      images: p.images || [],
      videos: p.videos || [],
      image_url: p.image_url || '',
      sizes: p.sizes || [
        { label: '60g', price: p.price || 0, cost: 0, stock: p.stock || 100 },
        { label: '120g', price: Math.round((p.price || 0) * 1.9), cost: 0, stock: 100 },
        { label: '180g', price: Math.round((p.price || 0) * 2.8), cost: 0, stock: 100 },
        { label: '240g', price: Math.round((p.price || 0) * 3.7), cost: 0, stock: 100 },
      ],
    })
    setMsg('')
  }

  async function saveProduct() {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.from('products').update({
      name: editing.name,
      description: editing.description,
      price: parseFloat(editing.price) || 0,
      mrp: parseFloat(editing.mrp) || 0,
      cost_price: parseFloat(editing.cost_price) || 0,
      stock: parseInt(editing.stock) || 0,
      reorder_level: parseInt(editing.reorder_level) || 10,
      best_before_days: parseInt(editing.best_before_days) || 365,
      is_active: editing.is_active,
      is_bestseller: editing.is_bestseller,
      image_url: editing.image_url,
      images: editing.images,
      videos: editing.videos,
    }).eq('id', editing.id)
    setSaving(false)
    if (error) { setMsg('âŒ ' + error.message); return }
    setMsg('âœ… Saved!')
    fetchProducts()
    setTimeout(() => setMsg(''), 3000)
  }

  async function uploadFile(file: File, type: 'image' | 'video', slot: number) {
    if (!editing) return
    const key = `${type}-${slot}`
    setUploading(key)
    const ext = file.name.split('.').pop()
    const filename = `${editing.id}/${type}-${slot}-${Date.now()}.${ext}`
    const bucket = type === 'image' ? 'product-images' : 'product-videos'

    const { error: upErr } = await supabase.storage.from(bucket).upload(filename, file, { upsert: true })
    if (upErr) { setMsg('âŒ Upload failed: ' + upErr.message); setUploading(null); return }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename)
    const publicUrl = urlData.publicUrl

    if (type === 'image') {
      const newImages = [...(editing.images || [])]
      newImages[slot] = publicUrl
      // First image is always the main image_url
      const newEditing = { ...editing, images: newImages, image_url: newImages[0] || editing.image_url }
      setEditing(newEditing)
      // Save immediately
      await supabase.from('products').update({ images: newImages, image_url: newImages[0] || editing.image_url }).eq('id', editing.id)
    } else {
      const newVideos = [...(editing.videos || [])]
      newVideos[slot] = publicUrl
      setEditing({ ...editing, videos: newVideos })
      await supabase.from('products').update({ videos: newVideos }).eq('id', editing.id)
    }

    setMsg('âœ… Uploaded!')
    setUploading(null)
    fetchProducts()
    setTimeout(() => setMsg(''), 3000)
  }

  async function removeMedia(type: 'image' | 'video', slot: number) {
    if (!editing) return
    if (type === 'image') {
      const newImages = [...(editing.images || [])]
      newImages[slot] = ''
      const firstImage = newImages.find(Boolean) || ''
      setEditing({ ...editing, images: newImages, image_url: firstImage })
      await supabase.from('products').update({ images: newImages, image_url: firstImage }).eq('id', editing.id)
    } else {
      const newVideos = [...(editing.videos || [])]
      newVideos[slot] = ''
      setEditing({ ...editing, videos: newVideos })
      await supabase.from('products').update({ videos: newVideos }).eq('id', editing.id)
    }
    setMsg('âœ… Removed')
    fetchProducts()
    setTimeout(() => setMsg(''), 2000)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    fetchProducts()
  }

  async function addProduct() {
    const { error } = await supabase.from('products').insert({
      name: newForm.name,
      price: parseFloat(newForm.price) || 0,
      stock: parseInt(newForm.stock) || 100,
      sku: newForm.sku,
      category: newForm.category,
      description: newForm.description,
      is_active: true,
      images: [],
      videos: [],
    })
    if (error) { setMsg('âŒ ' + error.message); return }
    setAddingNew(false)
    setNewForm({ name: '', price: '', stock: '100', sku: '', category: '', description: '' })
    fetchProducts()
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === 'all' ? true : tab === 'low' ? (p.stock <= (p.reorder_level || 10) && p.stock > 0) : tab === 'out' ? p.stock === 0 : true
    return matchSearch && matchTab
  })

  const lowCount = products.filter(p => p.stock <= (p.reorder_level || 10) && p.stock > 0 && p.is_active).length
  const outCount = products.filter(p => p.stock === 0 && p.is_active).length

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f2', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1008', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>ðŸ¾</span>
          <div>
            <div style={{ fontWeight: 700, color: '#c8973a' }}>Game of Bones</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {[['Dashboard','/dashboard'],['Orders','/orders'],['Products','/products'],['Inventory','/inventory'],['Finance','/finance'],['Analytics','/analytics']].map(([label, href]) => (
            <a key={href} href={href} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, color: href === '/products' ? '#1a1008' : 'rgba(255,255,255,0.7)', background: href === '/products' ? '#c8973a' : 'transparent', textDecoration: 'none' }}>{label}</a>
          ))}
        </nav>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1008', margin: 0 }}>Products</h1>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              style={{ padding: '9px 14px', border: '1.5px solid #e5ddd0', borderRadius: 8, fontSize: 13, width: 220, outline: 'none', background: 'white' }} />
            <button onClick={() => setAddingNew(true)}
              style={{ background: '#c8973a', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Add Product
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['all', `All (${products.length})`], ['low', `âš  Low (${lowCount})`], ['out', `ðŸ”´ Out (${outCount})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                background: tab === key ? '#1a1008' : '#e5ddd0', color: tab === key ? 'white' : '#5a4a3a' }}>{label}</button>
          ))}
        </div>

        {/* Products table */}
        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9f6f2', borderBottom: '1px solid #e5ddd0' }}>
                {['Product', 'Price', 'Stock', 'Status', 'Media', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a7a6a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8a7a6a' }}>Loading...</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f0ebe3' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5ddd0' }} />
                        : <div style={{ width: 40, height: 40, background: '#f0ebe3', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>ðŸ¦´</div>
                      }
                      <div>
                        <div style={{ fontWeight: 600, color: '#1a1008', fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#8a7a6a' }}>{p.category || 'â€”'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1008' }}>â‚¹{p.price}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: p.stock === 0 ? '#dc2626' : p.stock <= (p.reorder_level || 10) ? '#d97706' : '#16a34a', fontSize: 15 }}>{p.stock}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: p.is_active ? '#dcfce7' : '#fee2e2', color: p.is_active ? '#16a34a' : '#dc2626' }}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#8a7a6a' }}>
                    {(p.images || []).filter(Boolean).length} img Â· {(p.videos || []).filter(Boolean).length} vid
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ padding: '5px 12px', background: '#f0ebe3', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#1a1008' }}>Edit</button>
                      <button onClick={() => toggleActive(p.id, p.is_active)} style={{ padding: '5px 12px', background: p.is_active ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: p.is_active ? '#dc2626' : '#16a34a' }}>
                        {p.is_active ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 700, padding: 32, position: 'relative' }}>
            {/* Close */}
            <button onClick={() => setEditing(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#8a7a6a' }}>âœ•</button>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1008', marginBottom: 24 }}>{editing.name}</h2>

            {/* â”€â”€ IMAGES SECTION â”€â”€ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7a6a', marginBottom: 12 }}>Product Images (up to 5)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {Array.from({ length: MAX_IMAGES }).map((_, i) => {
                  const url = editing.images?.[i]
                  const isUploading = uploading === `image-${i}`
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ width: '100%', aspectRatio: '1', border: '2px dashed #e5ddd0', borderRadius: 8, overflow: 'hidden', background: url ? 'transparent' : '#f9f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          {url
                            ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : isUploading
                              ? <div style={{ fontSize: 11, color: '#8a7a6a', textAlign: 'center' }}>Uploading...</div>
                              : <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 24 }}>ðŸ“·</div>
                                  <div style={{ fontSize: 10, color: '#8a7a6a', marginTop: 4 }}>Add Photo {i + 1}</div>
                                </div>
                          }
                        </div>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'image', i)} />
                      </label>
                      {url && (
                        <button onClick={() => removeMedia('image', i)}
                          style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>âœ•</button>
                      )}
                      {i === 0 && url && (
                        <div style={{ position: 'absolute', bottom: 4, left: 4, background: '#c8973a', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>MAIN</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 8 }}>First image is the main product image shown on website</div>
            </div>

            {/* â”€â”€ VIDEOS SECTION â”€â”€ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7a6a', marginBottom: 12 }}>Product Videos (up to 2)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Array.from({ length: MAX_VIDEOS }).map((_, i) => {
                  const url = editing.videos?.[i]
                  const isUploading = uploading === `video-${i}`
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ border: '2px dashed #e5ddd0', borderRadius: 8, overflow: 'hidden', background: '#f9f6f2', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                          {url
                            ? <video src={url} controls style={{ width: '100%', borderRadius: 4, maxHeight: 140 }} />
                            : isUploading
                              ? <div style={{ textAlign: 'center', color: '#8a7a6a', fontSize: 12 }}>Uploading...</div>
                              : <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 28 }}>ðŸŽ¥</div>
                                  <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 6 }}>Add Video {i + 1}</div>
                                  <div style={{ fontSize: 10, color: '#b0a090', marginTop: 2 }}>MP4, MOV, up to 50MB</div>
                                </div>
                          }
                        </div>
                        <input type="file" accept="video/*" style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'video', i)} />
                      </label>
                      {url && (
                        <button onClick={() => removeMedia('video', i)}
                          style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#dc2626', color: 'white', border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>âœ•</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* â”€â”€ PRODUCT DETAILS â”€â”€ */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7a6a', marginBottom: 12 }}>Product Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[
                ['Product Name', 'name', 'text'],
                ['Selling Price (â‚¹)', 'price', 'number'],
                ['Base COGS (â‚¹)', 'cost_price', 'number'],
                ['Stock', 'stock', 'number'],
                ['Reorder Level', 'reorder_level', 'number'],
                ['Best Before (days)', 'best_before_days', 'number'],
              ].map(([label, field, type]) => (
                <div key={field}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={editing[field] ?? ''} onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5ddd0', borderRadius: 8, fontSize: 14, color: '#1a1008', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              {[['Product Active', 'is_active'], ['Bestseller', 'is_bestseller']].map(([label, field]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div onClick={() => setEditing({ ...editing, [field]: !editing[field] })}
                    style={{ width: 44, height: 24, borderRadius: 12, background: editing[field] ? '#16a34a' : '#d1d5db', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: editing[field] ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1008' }}>{label}</span>
                </label>
              ))}
            </div>

            {/* Size pricing */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7a6a', marginBottom: 10 }}>Size Pricing, COGS & Stock</div>
              <div style={{ border: '1px solid #e5ddd0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9f6f2' }}>
                      {['Size', 'Sell Price', 'COGS', 'Margin', 'Stock'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8a7a6a', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(editing.sizes || []).map((s: any, i: number) => {
                      const margin = s.price && s.cost ? Math.round(((s.price - s.cost) / s.price) * 100) : null
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #f0ebe3' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a1008', fontSize: 13 }}>{s.label}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" value={s.price || ''} onChange={e => {
                              const newSizes = [...editing.sizes]; newSizes[i] = { ...s, price: parseFloat(e.target.value) || 0 }; setEditing({ ...editing, sizes: newSizes })
                            }} style={{ width: 80, padding: '4px 8px', border: '1px solid #e5ddd0', borderRadius: 6, fontSize: 13, color: '#1a1008' }} />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" placeholder="Cost" value={s.cost || ''} onChange={e => {
                              const newSizes = [...editing.sizes]; newSizes[i] = { ...s, cost: parseFloat(e.target.value) || 0 }; setEditing({ ...editing, sizes: newSizes })
                            }} style={{ width: 80, padding: '4px 8px', border: '1px solid #e5ddd0', borderRadius: 6, fontSize: 13, color: '#1a1008' }} />
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: margin && margin > 50 ? '#16a34a' : margin && margin > 30 ? '#d97706' : '#dc2626' }}>
                            {margin !== null ? `${margin}%` : 'â€”'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" value={s.stock || ''} onChange={e => {
                              const newSizes = [...editing.sizes]; newSizes[i] = { ...s, stock: parseInt(e.target.value) || 0 }; setEditing({ ...editing, sizes: newSizes })
                            }} style={{ width: 70, padding: '4px 8px', border: '1px solid #e5ddd0', borderRadius: 6, fontSize: 13, color: '#1a1008' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Msg + Save */}
            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: msg.startsWith('âŒ') ? '#fee2e2' : '#dcfce7', color: msg.startsWith('âŒ') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', background: '#f0ebe3', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: '#5a4a3a' }}>Cancel</button>
              <button onClick={saveProduct} disabled={saving}
                style={{ padding: '10px 24px', background: '#c8973a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {addingNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 500, padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1008', marginBottom: 20 }}>Add New Product</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {[['Product Name *', 'name', 'text'], ['Selling Price (â‚¹) *', 'price', 'number'], ['Initial Stock', 'stock', 'number'], ['SKU', 'sku', 'text'], ['Category', 'category', 'text']].map(([label, field, type]) => (
                <div key={field}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={(newForm as any)[field]} onChange={e => setNewForm({ ...newForm, [field]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5ddd0', borderRadius: 8, fontSize: 14, color: '#1a1008', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={newForm.description} onChange={e => setNewForm({ ...newForm, description: e.target.value })} rows={3}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5ddd0', borderRadius: 8, fontSize: 14, color: '#1a1008', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
            </div>
            {msg && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', fontSize: 13 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setAddingNew(false)} style={{ padding: '10px 20px', background: '#f0ebe3', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: '#5a4a3a' }}>Cancel</button>
              <button onClick={addProduct} style={{ padding: '10px 24px', background: '#c8973a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Add Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
