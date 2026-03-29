'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductsPage() {
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<any>(null)
  const [search, setSearch]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]             = useState('')
  const [tab, setTab]             = useState('all')

  const [editForm, setEditForm] = useState({
    name: '', price: '', cost_price: '', stock: '',
    reorder_level: '', best_before_days: '', is_active: true,
  })

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, product_sizes(*)')
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  async function saveProduct() {
    if (!selected) return
    setSaving(true)
    await supabase.from('products').update({
      name:             editForm.name,
      price:            parseFloat(editForm.price) || 0,
      cost_price:       parseFloat(editForm.cost_price) || 0,
      stock:            parseInt(editForm.stock) || 0,
      reorder_level:    parseInt(editForm.reorder_level) || 10,
      best_before_days: parseInt(editForm.best_before_days) || 365,
      is_active:        editForm.is_active,
    }).eq('id', selected.id)

    await supabase.from('activity_log').insert({
      action:      'product updated',
      entity_type: 'product',
      entity_id:   selected.id,
      entity_name: editForm.name,
    })

    setSaving(false)
    setMsg('✅ Product saved!')
    fetchProducts()
    setTimeout(() => setMsg(''), 3000)
  }

  async function uploadImage(file: File) {
    if (!selected) return
    setUploading(true)
    const ext      = file.name.split('.').pop()
    const filename = `${selected.id}.${ext}`

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, file, { upsert: true })

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename)

      await supabase.from('products')
        .update({ image_url: urlData.publicUrl })
        .eq('id', selected.id)

      setSelected({ ...selected, image_url: urlData.publicUrl })
      fetchProducts()
      setMsg('✅ Image uploaded!')
      setTimeout(() => setMsg(''), 3000)
    } else {
      setMsg('❌ Upload failed: ' + error.message)
    }
    setUploading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    fetchProducts()
  }

  async function updateSizePrice(sizeId: string, price: number) {
    await supabase.from('product_sizes').update({ price }).eq('id', sizeId)
    fetchProducts()
  }

  async function updateSizeStock(sizeId: string, stock: number) {
    await supabase.from('product_sizes').update({ stock }).eq('id', sizeId)
    fetchProducts()
  }

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchTab =
      tab === 'all'      ? true :
      tab === 'low'      ? p.stock <= (p.reorder_level || 10) && p.stock > 0 :
      tab === 'out'      ? p.stock === 0 :
      tab === 'inactive' ? !p.is_active : true
    return matchSearch && matchTab
  })

  const lowStockCount = products.filter(p => p.stock <= (p.reorder_level || 10) && p.stock > 0 && p.is_active).length
  const outOfStock    = products.filter(p => p.stock === 0 && p.is_active).length

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Finance',   href: '/finance' },
    { label: 'Analytics', href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
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
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
        </div>

        {(lowStockCount > 0 || outOfStock > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {outOfStock > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">🔴</span>
                <div>
                  <div className="font-bold" style={{ color: '#ef4444' }}>{outOfStock} products out of stock</div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>Need immediate restocking</div>
                </div>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">🟡</span>
                <div>
                  <div className="font-bold" style={{ color: '#f59e0b' }}>{lowStockCount} products low on stock</div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>Below reorder level</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'all',      label: `All (${products.length})` },
            { key: 'low',      label: `⚠️ Low Stock (${lowStockCount})` },
            { key: 'out',      label: `🔴 Out of Stock (${outOfStock})` },
            { key: 'inactive', label: `Inactive (${products.filter(p => !p.is_active).length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: tab === t.key ? '#1a1008' : 'white',
                color: tab === t.key ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Product','SKU','Price','Cost','Margin','Stock','Reorder At','Status','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No products found</td></tr>
              ) : filtered.map(product => {
                const margin     = product.cost_price > 0
                  ? Math.round(((product.price - product.cost_price) / product.price) * 100)
                  : null
                const isLow      = product.stock <= (product.reorder_level || 10) && product.stock > 0
                const isOut      = product.stock === 0
                return (
                  <tr key={product.id} className="hover:bg-gray-50"
                    style={{ background: isOut ? '#fef2f2' : isLow ? '#fefce8' : 'white' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ background: '#f3f4f6' }}>
                            🦴
                          </div>
                        )}
                        <div className="font-medium" style={{ color: '#111827' }}>{product.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6b7280' }}>
                      {product.sku}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                      ₹{product.price}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#6b7280' }}>
                      {product.cost_price > 0 ? `₹${product.cost_price}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {margin !== null ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: margin >= 50 ? '#dcfce7' : margin >= 30 ? '#fef3c7' : '#fef2f2',
                            color: margin >= 50 ? '#166534' : margin >= 30 ? '#92400e' : '#ef4444'
                          }}>
                          {margin}%
                        </span>
                      ) : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-lg"
                        style={{ color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                      {product.reorder_level || 10}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background: product.is_active ? '#dcfce7' : '#f3f4f6',
                          color: product.is_active ? '#166534' : '#6b7280'
                        }}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelected(product)
                            setEditForm({
                              name:             product.name,
                              price:            product.price,
                              cost_price:       product.cost_price || '',
                              stock:            product.stock,
                              reorder_level:    product.reorder_level || 10,
                              best_before_days: product.best_before_days || 365,
                              is_active:        product.is_active,
                            })
                            setMsg('')
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: '#f3f4f6', color: '#374151' }}>
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(product.id, product.is_active)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{
                            background: product.is_active ? '#fef2f2' : '#dcfce7',
                            color: product.is_active ? '#ef4444' : '#166534'
                          }}>
                          {product.is_active ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>{selected.name}</div>
              <button onClick={() => setSelected(null)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
            </div>

            <div className="p-6 space-y-4">
              {msg && (
                <div className="px-4 py-3 rounded-lg text-sm"
                  style={{
                    background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                    color: msg.startsWith('✅') ? '#166534' : '#ef4444',
                  }}>
                  {msg}
                </div>
              )}

              {/* Image upload */}
              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>
                  Product Image
                </div>
                <div className="flex items-center gap-4">
                  {selected.image_url ? (
                    <img src={selected.image_url} alt={selected.name}
                      className="w-20 h-20 rounded-xl object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl"
                      style={{ background: '#f3f4f6' }}>
                      🦴
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer">
                      <div className="text-sm px-4 py-2 rounded-lg font-medium text-white inline-block"
                        style={{ background: uploading ? '#9ca3af' : '#c8973a' }}>
                        {uploading ? 'Uploading...' : '📷 Upload Image'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadImage(file)
                        }}
                      />
                    </label>
                    <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                      JPG, PNG up to 5MB
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Product Name',     key: 'name',             type: 'text' },
                  { label: 'Selling Price (₹)', key: 'price',           type: 'number' },
                  { label: 'Cost Price (₹)',    key: 'cost_price',      type: 'number' },
                  { label: 'Current Stock',     key: 'stock',           type: 'number' },
                  { label: 'Reorder Level',     key: 'reorder_level',   type: 'number' },
                  { label: 'Best Before (days)', key: 'best_before_days', type: 'number' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={editForm[field.key as keyof typeof editForm] as string}
                      onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                ))}
              </div>

              {/* Margin preview */}
              {editForm.cost_price && editForm.price && (
                <div className="p-3 rounded-lg" style={{ background: '#f9f6f2' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>Margin Preview</div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: '#6b7280' }}>Profit per unit</span>
                    <span className="font-bold" style={{ color: '#10b981' }}>
                      ₹{(parseFloat(editForm.price) - parseFloat(editForm.cost_price)).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span style={{ color: '#6b7280' }}>Margin %</span>
                    <span className="font-bold" style={{ color: '#10b981' }}>
                      {Math.round(((parseFloat(editForm.price) - parseFloat(editForm.cost_price)) / parseFloat(editForm.price)) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: '#f9fafb' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#111827' }}>Product Active</div>
                  <div className="text-xs" style={{ color: '#6b7280' }}>
                    Inactive products are hidden from your website
                  </div>
                </div>
                <button
                  onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                  className="w-12 h-6 rounded-full transition-colors relative"
                  style={{ background: editForm.is_active ? '#10b981' : '#d1d5db' }}>
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all"
                    style={{ left: editForm.is_active ? '26px' : '2px' }} />
                </button>
              </div>

              {/* Sizes */}
              {selected.product_sizes?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#6b7280' }}>
                    Size Pricing & Stock
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {['Size','Price','Stock'].map(h => (
                          <th key={h} className="text-left py-2 text-xs font-semibold uppercase"
                            style={{ color: '#6b7280' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.product_sizes.map((size: any) => (
                        <tr key={size.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td className="py-2 font-medium" style={{ color: '#374151' }}>{size.label}</td>
                          <td className="py-2">
                            <input
                              type="number"
                              defaultValue={size.price}
                              onBlur={e => {
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val !== size.price) updateSizePrice(size.id, val)
                              }}
                              className="w-24 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              style={{ color: '#111827' }}
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              defaultValue={size.stock}
                              onBlur={e => {
                                const val = parseInt(e.target.value)
                                if (!isNaN(val) && val !== size.stock) updateSizeStock(size.id, val)
                              }}
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              style={{ color: '#111827' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelected(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={saveProduct} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
