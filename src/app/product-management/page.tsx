'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductManagementPage() {
  const [tab, setTab]               = useState('categories')
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts]     = useState<any[]>([])
  const [reviews, setReviews]       = useState<any[]>([])
  const [orders, setOrders]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')

  const [newCat, setNewCat] = useState({ name: '', description: '' })
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [productTags, setProductTags] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [cats, prods, revs, ords] = await Promise.all([
      supabase.from('product_categories').select('*').order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('product_reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('items, created_at').gte('created_at', thirtyDaysAgo.toISOString()),
    ])
    setCategories(cats.data || [])
    setProducts(prods.data || [])
    setReviews(revs.data || [])
    setOrders(ords.data || [])
    setLoading(false)
  }

  async function addCategory() {
    if (!newCat.name) return
    setSaving(true)
    const slug = newCat.name.toLowerCase().replace(/\s+/g, '-')
    await supabase.from('product_categories').insert({ ...newCat, slug })
    setSaving(false)
    setNewCat({ name: '', description: '' })
    setMsg('âœ… Category added!')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteCategory(id: string) {
    await supabase.from('product_categories').delete().eq('id', id)
    fetchData()
  }

  async function saveProductTags() {
    if (!editingProduct) return
    setSaving(true)
    const tagsArray = productTags.split(',').map(t => t.trim()).filter(Boolean)
    await supabase.from('products').update({ tags: tagsArray }).eq('id', editingProduct.id)
    setSaving(false)
    setEditingProduct(null)
    setMsg('âœ… Tags saved!')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleBestseller(id: string, current: boolean) {
    await supabase.from('products').update({ is_bestseller: !current }).eq('id', id)
    fetchData()
  }

  async function updateReviewStatus(id: string, status: string) {
    await supabase.from('product_reviews').update({ status }).eq('id', id)
    fetchData()
  }

  async function updateBestsellers() {
    setSaving(true)
    const salesMap: Record<string, number> = {}
    orders.forEach(o => {
      ;(o.items || []).forEach((item: any) => {
        salesMap[item.name] = (salesMap[item.name] || 0) + item.qty
      })
    })
    const topProducts = Object.entries(salesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    for (const product of products) {
      await supabase.from('products')
        .update({ is_bestseller: topProducts.includes(product.name) })
        .eq('id', product.id)
    }
    setSaving(false)
    setMsg('âœ… Bestsellers updated based on last 30 days sales!')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  // Dead stock â€” no sales in 30 days
  const soldProducts = new Set(
    orders.flatMap(o => (o.items || []).map((i: any) => i.name))
  )
  const deadStock = products.filter(p => !soldProducts.has(p.name))

  // Inventory valuation
  const totalValue = products.reduce((s, p) => s + ((p.cost_price || p.price * 0.4) * p.stock), 0)

  const navLinks = [
    { label: 'Dashboard',    href: '/dashboard' },
    { label: 'Products',     href: '/products' },
    { label: 'Prod Mgmt',    href: '/product-management' },
    { label: 'Inventory',    href: '/inventory' },
    { label: 'Analytics',    href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
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
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Product Management</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Categories, tags, reviews, bestsellers, dead stock
            </p>
          </div>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">
            {msg}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'categories', label: 'ðŸ“ Categories' },
            { key: 'tags',       label: 'ðŸ·ï¸ Tags' },
            { key: 'reviews',    label: `â­ Reviews (${reviews.filter(r=>r.status==='pending').length} pending)` },
            { key: 'bestseller', label: 'ðŸ”¥ Bestsellers' },
            { key: 'deadstock',  label: `ðŸ’€ Dead Stock (${deadStock.length})` },
            { key: 'valuation',  label: 'ðŸ’° Inventory Value' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tab === t.key ? '#1a1008' : 'white',
                color: tab === t.key ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Categories */}
        {tab === 'categories' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Add Category</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Name *</label>
                  <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                    placeholder="Fish Treats, Organ Meats..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Description</label>
                  <textarea value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })}
                    placeholder="Category description..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    style={{ color: '#111827' }}
                  />
                </div>
                <button onClick={addCategory} disabled={saving}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Adding...' : '+ Add Category'}
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-3">
                {loading ? (
                  <div style={{ color: '#2a1f1a' }}>Loading...</div>
                ) : categories.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center col-span-2" style={{ color: '#2a1f1a' }}>
                    No categories yet
                  </div>
                ) : categories.map(cat => (
                  <div key={cat.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium" style={{ color: '#111827' }}>{cat.name}</div>
                        <div className="text-xs mt-0.5 font-mono" style={{ color: '#2a1f1a' }}>/{cat.slug}</div>
                        {cat.description && (
                          <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{cat.description}</div>
                        )}
                      </div>
                      <button onClick={() => deleteCategory(cat.id)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: '#fef2f2', color: '#ef4444' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        {tab === 'tags' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b">
              <p className="text-sm" style={{ color: '#1a1008' }}>
                Add tags to products for filtering â€” grain-free, high-protein, fish-based, etc.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Product','Current Tags','Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                      style={{ color: '#1a1008' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{product.name}</td>
                    <td className="px-4 py-3">
                      {editingProduct?.id === product.id ? (
                        <input
                          value={productTags}
                          onChange={e => setProductTags(e.target.value)}
                          placeholder="grain-free, high-protein, fish-based"
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                          style={{ color: '#111827' }}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(product.tags || []).length > 0 ? (
                            product.tags.map((tag: string) => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#dbeafe', color: '#1e40af' }}>
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#2a1f1a', fontSize: 12 }}>No tags</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingProduct?.id === product.id ? (
                        <div className="flex gap-2">
                          <button onClick={saveProductTags} disabled={saving}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                            style={{ background: '#10b981' }}>
                            {saving ? '...' : 'Save'}
                          </button>
                          <button onClick={() => setEditingProduct(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: '#f3f4f6', color: '#1a1008' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingProduct(product)
                            setProductTags((product.tags || []).join(', '))
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: '#f3f4f6', color: '#1a1008' }}>
                          Edit Tags
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reviews */}
        {tab === 'reviews' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Product','Customer','Rating','Review','Status','Date','Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                      style={{ color: '#1a1008' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
                ) : reviews.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                    No reviews yet. Reviews will appear here once customers submit them.
                  </td></tr>
                ) : reviews.map(review => (
                  <tr key={review.id} className="hover:bg-gray-50"
                    style={{ background: review.status === 'pending' ? '#fefce8' : 'white' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>
                      {review.product_name || 'â€”'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#1a1008' }}>{review.customer_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ color: s <= (review.rating || 0) ? '#f59e0b' : '#e5e7eb' }}>â˜…</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#1a1008', maxWidth: 200 }}>
                      {review.review || 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{
                          background: review.status === 'approved' ? '#dcfce7' : review.status === 'rejected' ? '#fef2f2' : '#fef3c7',
                          color: review.status === 'approved' ? '#166534' : review.status === 'rejected' ? '#ef4444' : '#92400e'
                        }}>
                        {review.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#2a1f1a' }}>
                      {new Date(review.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {review.status !== 'approved' && (
                          <button onClick={() => updateReviewStatus(review.id, 'approved')}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: '#dcfce7', color: '#166534' }}>
                            Approve
                          </button>
                        )}
                        {review.status !== 'rejected' && (
                          <button onClick={() => updateReviewStatus(review.id, 'rejected')}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: '#fef2f2', color: '#ef4444' }}>
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bestsellers */}
        {tab === 'bestseller' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm" style={{ color: '#1a1008' }}>
                Top 5 products by sales in the last 30 days are automatically marked as bestsellers.
              </p>
              <button onClick={updateBestsellers} disabled={saving}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                style={{ background: '#c8973a' }}>
                {saving ? 'Updating...' : 'ðŸ”¥ Auto-update Bestsellers'}
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Product','Sales (30 days)','Bestseller','Toggle'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#1a1008' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(product => {
                    const sales = orders.reduce((s, o) => {
                      return s + (o.items || []).filter((i: any) => i.name === product.name).reduce((ss: number, i: any) => ss + i.qty, 0)
                    }, 0)
                    return (
                      <tr key={product.id} className="hover:bg-gray-50"
                        style={{ background: product.is_bestseller ? '#fefce8' : 'white' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {product.is_bestseller && <span>ðŸ”¥</span>}
                            <span className="font-medium" style={{ color: '#111827' }}>{product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#1a1008' }}>{sales} units</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              background: product.is_bestseller ? '#fef3c7' : '#f3f4f6',
                              color: product.is_bestseller ? '#92400e' : '#6b7280'
                            }}>
                            {product.is_bestseller ? 'ðŸ”¥ Bestseller' : 'Normal'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleBestseller(product.id, product.is_bestseller)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{
                              background: product.is_bestseller ? '#fef2f2' : '#fef3c7',
                              color: product.is_bestseller ? '#ef4444' : '#92400e'
                            }}>
                            {product.is_bestseller ? 'Remove' : 'Mark Bestseller'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Dead Stock */}
        {tab === 'deadstock' && (
          <div>
            <div className="mb-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm" style={{ color: '#92400e' }}>
                  âš ï¸ These products have had <strong>zero sales in the last 30 days</strong>.
                  Consider running a flash sale or promotion to clear this stock.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Product','SKU','Current Stock','Price','Cost Value','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#1a1008' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deadStock.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                      ðŸŽ‰ All products have sold in the last 30 days!
                    </td></tr>
                  ) : deadStock.map(product => {
                    const costValue = (product.cost_price || product.price * 0.4) * product.stock
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{product.name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#2a1f1a' }}>{product.sku}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#f59e0b' }}>{product.stock}</td>
                        <td className="px-4 py-3" style={{ color: '#1a1008' }}>â‚¹{product.price}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#ef4444' }}>
                          â‚¹{Math.round(costValue).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <a href="/promotions"
                            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                            style={{ background: '#f59e0b', textDecoration: 'none' }}>
                            âš¡ Flash Sale
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Valuation */}
        {tab === 'valuation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Stock Value (Cost)', value: 'â‚¹' + Math.round(totalValue).toLocaleString('en-IN'), icon: 'ðŸ’°', color: '#10b981' },
                { label: 'Total Products',           value: products.length,                                       icon: 'ðŸ¦´', color: '#3b82f6' },
                { label: 'Total Units',              value: products.reduce((s,p) => s+p.stock, 0),               icon: 'ðŸ“¦', color: '#8b5cf6' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Product','Stock','Cost Price','Selling Price','Stock Value (Cost)','Stock Value (Selling)','Margin'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#1a1008' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(product => {
                    const cost    = product.cost_price || product.price * 0.4
                    const costVal = Math.round(cost * product.stock)
                    const sellVal = product.price * product.stock
                    const margin  = Math.round(((product.price - cost) / product.price) * 100)
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{product.name}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#1a1008' }}>{product.stock}</td>
                        <td className="px-4 py-3" style={{ color: '#1a1008' }}>
                          {product.cost_price > 0 ? 'â‚¹' + product.cost_price : <span style={{ color: '#2a1f1a' }}>Est.</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#1a1008' }}>â‚¹{product.price}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#ef4444' }}>
                          â‚¹{costVal.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#10b981' }}>
                          â‚¹{sellVal.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: margin >= 50 ? '#dcfce7' : margin >= 30 ? '#fef3c7' : '#fef2f2',
                              color: margin >= 50 ? '#166534' : margin >= 30 ? '#92400e' : '#ef4444'
                            }}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
