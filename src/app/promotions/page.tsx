'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PromotionsPage() {
  const [tab, setTab]             = useState('flashsale')
  const [products, setProducts]   = useState<any[]>([])
  const [bundles, setBundles]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [msg, setMsg]             = useState('')

  const [flashSale, setFlashSale] = useState({
    productId:  '',
    salePrice:  '',
    startDate:  '',
    startTime:  '',
    endDate:    '',
    endTime:    '',
  })

  const [newBundle, setNewBundle] = useState({
    name:        '',
    description: '',
    bundle_price: '',
    items:       [] as { name: string; size: string; qty: number }[]
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [p, b] = await Promise.all([
      supabase.from('products').select('*, product_sizes(*)').eq('is_active', true).order('name'),
      supabase.from('product_bundles').select('*').order('created_at', { ascending: false }),
    ])
    setProducts(p.data || [])
    setBundles(b.data || [])
    setLoading(false)
  }

  async function scheduleFlashSale() {
    if (!flashSale.productId || !flashSale.salePrice || !flashSale.startDate || !flashSale.endDate) {
      setMsg('Please fill in all fields')
      return
    }
    setSaving(true)
    const start = new Date(`${flashSale.startDate}T${flashSale.startTime || '00:00'}:00`)
    const end   = new Date(`${flashSale.endDate}T${flashSale.endTime || '23:59'}:00`)

    await supabase.from('products').update({
      flash_sale_price: parseFloat(flashSale.salePrice),
      flash_sale_start: start.toISOString(),
      flash_sale_end:   end.toISOString(),
    }).eq('id', flashSale.productId)

    await supabase.from('activity_log').insert({
      action:      'flash sale scheduled',
      entity_type: 'product',
      entity_id:   flashSale.productId,
      details:     `₹${flashSale.salePrice} from ${flashSale.startDate} to ${flashSale.endDate}`,
    })

    setSaving(false)
    setMsg('✅ Flash sale scheduled!')
    setFlashSale({ productId:'', salePrice:'', startDate:'', startTime:'', endDate:'', endTime:'' })
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function cancelFlashSale(productId: string) {
    await supabase.from('products').update({
      flash_sale_price: null,
      flash_sale_start: null,
      flash_sale_end:   null,
    }).eq('id', productId)
    fetchData()
  }

  async function addBundle() {
    if (!newBundle.name || !newBundle.bundle_price || newBundle.items.length === 0) {
      setMsg('Please fill name, price and add items')
      return
    }
    setSaving(true)
    const originalPrice = newBundle.items.reduce((s, item) => {
      const product = products.find(p => p.name === item.name)
      return s + (product?.price || 0) * item.qty
    }, 0)

    await supabase.from('product_bundles').insert({
      name:             newBundle.name,
      description:      newBundle.description,
      bundle_price:     parseFloat(newBundle.bundle_price),
      original_price:   originalPrice,
      discount_percent: originalPrice ? Math.round((1 - parseFloat(newBundle.bundle_price) / originalPrice) * 100) : 0,
      items:            newBundle.items,
      is_active:        true,
    })
    setSaving(false)
    setShowAddBundle(false)
    setNewBundle({ name:'', description:'', bundle_price:'', items:[] })
    fetchData()
  }

  async function toggleBundle(id: string, current: boolean) {
    await supabase.from('product_bundles').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  function addBundleItem() {
    setNewBundle({
      ...newBundle,
      items: [...newBundle.items, { name: '', size: '', qty: 1 }]
    })
  }

  function updateBundleItem(index: number, field: string, value: any) {
    const items = [...newBundle.items]
    items[index] = { ...items[index], [field]: value }
    setNewBundle({ ...newBundle, items })
  }

  const activeFlashSales = products.filter(p => p.flash_sale_price && p.flash_sale_end && new Date(p.flash_sale_end) > new Date())

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'Orders',      href: '/orders' },
    { label: 'Products',    href: '/products' },
    { label: 'Promotions',  href: '/promotions' },
    { label: 'Coupons',     href: '/coupons' },
    { label: 'Campaigns',   href: '/campaigns' },
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Promotions</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Flash sales and product bundles
          </p>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('✅') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['flashsale', 'bundles'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tab === t ? '#1a1008' : 'white',
                color: tab === t ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t === 'flashsale' ? '⚡ Flash Sales' : '🎁 Bundles'}
            </button>
          ))}
        </div>

        {/* ── FLASH SALE TAB ── */}
        {tab === 'flashsale' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Schedule new flash sale */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Schedule Flash Sale</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Product
                  </label>
                  <select
                    value={flashSale.productId}
                    onChange={e => setFlashSale({ ...flashSale, productId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}>
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Flash Sale Price (₹)
                  </label>
                  <input
                    type="number"
                    value={flashSale.salePrice}
                    onChange={e => setFlashSale({ ...flashSale, salePrice: e.target.value })}
                    placeholder="Sale price..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Start Date</label>
                    <input type="date" value={flashSale.startDate}
                      onChange={e => setFlashSale({ ...flashSale, startDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Start Time</label>
                    <input type="time" value={flashSale.startTime}
                      onChange={e => setFlashSale({ ...flashSale, startTime: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>End Date</label>
                    <input type="date" value={flashSale.endDate}
                      onChange={e => setFlashSale({ ...flashSale, endDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>End Time</label>
                    <input type="time" value={flashSale.endTime}
                      onChange={e => setFlashSale({ ...flashSale, endTime: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                </div>
                <button onClick={scheduleFlashSale} disabled={saving}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#c8973a' }}>
                  {saving ? 'Scheduling...' : '⚡ Schedule Flash Sale'}
                </button>
              </div>
            </div>

            {/* Active flash sales */}
            <div>
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>
                Active Flash Sales ({activeFlashSales.length})
              </h3>
              {activeFlashSales.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#9ca3af' }}>
                  No active flash sales
                </div>
              ) : activeFlashSales.map(product => {
                const discount = Math.round((1 - product.flash_sale_price / product.price) * 100)
                const endsAt   = new Date(product.flash_sale_end)
                const hoursLeft = Math.round((endsAt.getTime() - Date.now()) / 3600000)
                return (
                  <div key={product.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium" style={{ color: '#111827' }}>{product.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs line-through" style={{ color: '#9ca3af' }}>₹{product.price}</span>
                          <span className="font-bold" style={{ color: '#ef4444' }}>₹{product.flash_sale_price}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                            style={{ background: '#fef2f2', color: '#ef4444' }}>
                            {discount}% OFF
                          </span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                          ⏱️ Ends in {hoursLeft}h
                        </div>
                      </div>
                      <button onClick={() => cancelFlashSale(product.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: '#fef2f2', color: '#ef4444' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── BUNDLES TAB ── */}
        {tab === 'bundles' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm" style={{ color: '#6b7280' }}>
                {bundles.length} bundles created
              </div>
              <button onClick={() => setShowAddBundle(true)}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                style={{ background: '#c8973a' }}>
                + Create Bundle
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div style={{ color: '#9ca3af' }}>Loading...</div>
              ) : bundles.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center col-span-3" style={{ color: '#9ca3af' }}>
                  No bundles yet. Create your first bundle.
                </div>
              ) : bundles.map(bundle => (
                <div key={bundle.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-bold" style={{ color: '#111827' }}>{bundle.name}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: bundle.is_active ? '#dcfce7' : '#f3f4f6',
                        color: bundle.is_active ? '#166534' : '#6b7280'
                      }}>
                      {bundle.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {bundle.description && (
                    <div className="text-xs mb-3" style={{ color: '#6b7280' }}>{bundle.description}</div>
                  )}
                  <div className="mb-3">
                    {(bundle.items || []).map((item: any, i: number) => (
                      <div key={i} className="text-xs py-0.5" style={{ color: '#374151' }}>
                        {item.qty}× {item.name} ({item.size})
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      {bundle.original_price > bundle.bundle_price && (
                        <span className="text-xs line-through mr-2" style={{ color: '#9ca3af' }}>
                          ₹{bundle.original_price}
                        </span>
                      )}
                      <span className="font-bold text-lg" style={{ color: '#c8973a' }}>
                        ₹{bundle.bundle_price}
                      </span>
                    </div>
                    {bundle.discount_percent > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{ background: '#dcfce7', color: '#166534' }}>
                        {bundle.discount_percent}% OFF
                      </span>
                    )}
                  </div>
                  <button onClick={() => toggleBundle(bundle.id, bundle.is_active)}
                    className="w-full py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: bundle.is_active ? '#fef2f2' : '#dcfce7',
                      color: bundle.is_active ? '#ef4444' : '#166534'
                    }}>
                    {bundle.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Bundle Modal */}
      {showAddBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Create Bundle</div>
              <button onClick={() => setShowAddBundle(false)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Bundle Name *</label>
                <input
                  value={newBundle.name}
                  onChange={e => setNewBundle({ ...newBundle, name: e.target.value })}
                  placeholder="Starter Pack, Fish Lover Bundle..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Description</label>
                <input
                  value={newBundle.description}
                  onChange={e => setNewBundle({ ...newBundle, description: e.target.value })}
                  placeholder="Perfect for new dog owners..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Bundle Price (₹) *</label>
                <input
                  type="number"
                  value={newBundle.bundle_price}
                  onChange={e => setNewBundle({ ...newBundle, bundle_price: e.target.value })}
                  placeholder="999"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: '#374151' }}>Items in Bundle</label>
                  <button onClick={addBundleItem}
                    className="text-xs px-3 py-1 rounded font-medium"
                    style={{ background: '#f3f4f6', color: '#374151' }}>
                    + Add Item
                  </button>
                </div>
                {newBundle.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select
                      value={item.name}
                      onChange={e => updateBundleItem(i, 'name', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ color: '#111827' }}>
                      <option value="">Product...</option>
                      {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <input
                      value={item.size}
                      onChange={e => updateBundleItem(i, 'size', e.target.value)}
                      placeholder="Size"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => updateBundleItem(i, 'qty', parseInt(e.target.value))}
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ color: '#111827' }}
                      min="1"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddBundle(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={addBundle} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Creating...' : 'Create Bundle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}