'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, product_sizes(*)')
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function uploadImage(file: File) {
    setUploading(true)
    const ext      = file.name.split('.').pop()
    const filename = `products/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, file, { upsert: true })
    if (error) {
      alert('Upload failed: ' + error.message)
      setUploading(false)
      return null
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
    setUploading(false)
    return data.publicUrl
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const urls: string[] = []
    for (const file of files) {
      const url = await uploadImage(file)
      if (url) urls.push(url)
    }
    const existing = editing.images || []
    setEditing({ ...editing, images: [...existing, ...urls] })
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const filename = `products/videos/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, file, { upsert: true })
    if (error) {
      alert('Video upload failed: ' + error.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
    setEditing({ ...editing, video_url: data.publicUrl })
    setUploading(false)
  }

  function removeImage(index: number) {
    const imgs = [...(editing.images || [])]
    imgs.splice(index, 1)
    setEditing({ ...editing, images: imgs })
  }

  async function saveProduct() {
    setSaving(true)
    setMsg('')
    const payload = {
      name:         editing.name,
      sku:          editing.sku,
      description:  editing.description,
      price:        Number(editing.price),
      mrp:          Number(editing.mrp),
      weight_grams: Number(editing.weight_grams),
      length_cm:    Number(editing.length_cm),
      width_cm:     Number(editing.width_cm),
      height_cm:    Number(editing.height_cm),
      stock:        Number(editing.stock),
      category:     editing.category,
      filter:       editing.filter,
      images:       editing.images || [],
      video_url:    editing.video_url,
      is_active:    editing.is_active,
    }
    if (editing.id) {
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('products').insert(payload)
    }
    setMsg('Saved successfully!')
    setSaving(false)
    fetchProducts()
    setTimeout(() => { setEditing(null); setMsg('') }, 1000)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    fetchProducts()
  }

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const newProduct = {
    name: '', sku: '', description: '', price: 0, mrp: 0,
    weight_grams: 0, length_cm: 0, width_cm: 0, height_cm: 0,
    stock: 0, category: '', filter: '', images: [], video_url: '', is_active: true
  }

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Coupons',   href: '/coupons' },
    { label: 'Banners',   href: '/banners' },
  ]

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
      {children}
    </label>
  )

  const Input = ({ ...props }) => (
    <input {...props}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
      style={{ color: '#111827', background: '#fff' }}
    />
  )

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      {/* Nav */}
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Products</h1>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-56 focus:outline-none bg-white"
              style={{ color: '#111827' }}
            />
            <button onClick={() => setEditing(newProduct)}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: '#c8973a' }}>
              + Add Product
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Product', 'SKU', 'Price', 'MRP', 'Stock', 'Weight', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No products found</td></tr>
              ) : filtered.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                          🦴
                        </div>
                      )}
                      <div>
                        <div className="font-medium" style={{ color: '#111827' }}>{product.name}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>{product.filter}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6b7280' }}>
                    {product.sku || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                    ₹{product.price?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs line-through" style={{ color: '#9ca3af' }}>
                    {product.mrp ? '₹' + product.mrp : '—'}
                  </td>
                  <td className="px-4 py-3 font-bold"
                    style={{ color: product.stock < 10 ? '#ef4444' : '#111827' }}>
                    {product.stock}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                    {product.weight_grams ? product.weight_grams + 'g' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(product.id, product.is_active)}
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: product.is_active ? '#dcfce7' : '#f3f4f6',
                        color: product.is_active ? '#15803d' : '#6b7280'
                      }}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing({ ...product, images: product.images || [] })}
                      className="text-xs px-3 py-1.5 rounded-lg hover:bg-gray-200"
                      style={{ background: '#f3f4f6', color: '#374151' }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto">

            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-lg" style={{ color: '#111827' }}>
                {editing.id ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setEditing(null)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
            </div>

            <div className="p-6 space-y-5">
              {msg && (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
                  {msg}
                </div>
              )}

              {/* Images */}
              <div>
                <Label>Product Images</Label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {(editing.images || []).map((img: string, i: number) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition-colors text-xs gap-1">
                    {uploading ? '...' : <>
                      <span className="text-2xl">+</span>
                      <span>Add Photo</span>
                    </>}
                  </button>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  Click the + box to upload photos. You can add multiple images.
                </p>
              </div>

              {/* Video */}
              <div>
                <Label>Product Video</Label>
                {editing.video_url ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">🎥</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                        Video uploaded
                      </div>
                      <div className="text-xs truncate" style={{ color: '#9ca3af' }}>
                        {editing.video_url}
                      </div>
                    </div>
                    <button onClick={() => setEditing({ ...editing, video_url: '' })}
                      className="text-xs px-2 py-1 rounded" style={{ color: '#ef4444' }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm hover:border-yellow-400 transition-colors"
                    style={{ color: '#6b7280' }}>
                    {uploading ? 'Uploading...' : '🎥 Click to upload video (MP4, MOV)'}
                  </button>
                )}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
              </div>

              {/* Name + SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={editing.name || ''}
                    onChange={(e: any) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Chicken Jerky"
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={editing.sku || ''}
                    onChange={(e: any) => setEditing({ ...editing, sku: e.target.value })}
                    placeholder="GOB-CHK-001"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    value={editing.filter || ''}
                    onChange={e => setEditing({ ...editing, filter: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827', background: '#fff' }}>
                    <option value="">Select...</option>
                    <option value="jerky">Jerky</option>
                    <option value="chew">Chew</option>
                    <option value="organ">Organ</option>
                    <option value="fish">Fish</option>
                    <option value="wholeprey">Whole Prey</option>
                    <option value="bundle">Bundle</option>
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price (₹) *</Label>
                  <Input type="number"
                    value={editing.price || ''}
                    onChange={(e: any) => setEditing({ ...editing, price: e.target.value })}
                    placeholder="329"
                  />
                </div>
                <div>
                  <Label>MRP (₹)</Label>
                  <Input type="number"
                    value={editing.mrp || ''}
                    onChange={(e: any) => setEditing({ ...editing, mrp: e.target.value })}
                    placeholder="399"
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number"
                    value={editing.stock || ''}
                    onChange={(e: any) => setEditing({ ...editing, stock: e.target.value })}
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Weight (g)</Label>
                  <Input type="number"
                    value={editing.weight_grams || ''}
                    onChange={(e: any) => setEditing({ ...editing, weight_grams: e.target.value })}
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label>Length (cm)</Label>
                  <Input type="number"
                    value={editing.length_cm || ''}
                    onChange={(e: any) => setEditing({ ...editing, length_cm: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number"
                    value={editing.width_cm || ''}
                    onChange={(e: any) => setEditing({ ...editing, width_cm: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input type="number"
                    value={editing.height_cm || ''}
                    onChange={(e: any) => setEditing({ ...editing, height_cm: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  placeholder="Describe this product..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ color: '#111827', background: '#fff' }}
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                    Show on website
                  </div>
                  <div className="text-xs" style={{ color: '#6b7280' }}>
                    {editing.is_active ? 'Customers can see and buy this product' : 'Hidden from customers'}
                  </div>
                </div>
                <button
                  onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className="w-12 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ background: editing.is_active ? '#22c55e' : '#d1d5db' }}>
                  <div className="w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5"
                    style={{ transform: editing.is_active ? 'translateX(24px)' : 'translateX(0)' }} />
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={saveProduct} disabled={saving || uploading}
                className="flex-1 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: '#1a1008' }}>
                {saving ? 'Saving...' : uploading ? 'Uploading...' : editing.id ? 'Save Changes' : 'Add Product'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-3 rounded-lg font-semibold"
                style={{ background: '#f3f4f6', color: '#374151' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}