'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  useEffect(() => { fetchCoupons() }, [])

  async function fetchCoupons() {
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }

  async function saveCoupon() {
    setSaving(true)
    setMsg('')
    const payload = {
      code:        editing.code.toUpperCase().trim(),
      type:        editing.type,
      value:       Number(editing.value),
      min_order:   Number(editing.min_order || 0),
      max_uses:    editing.max_uses ? Number(editing.max_uses) : null,
      valid_from:  editing.valid_from || null,
      valid_until: editing.valid_until || null,
      is_active:   editing.is_active,
    }
    if (editing.id) {
      await supabase.from('coupons').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('coupons').insert(payload)
    }
    setMsg('Saved!')
    setSaving(false)
    fetchCoupons()
    setTimeout(() => { setEditing(null); setMsg('') }, 800)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('coupons').update({ is_active: !current }).eq('id', id)
    fetchCoupons()
  }

  async function deleteCoupon(id: string) {
    if (!confirm('Delete this coupon?')) return
    await supabase.from('coupons').delete().eq('id', id)
    fetchCoupons()
  }

  const newCoupon = {
    code: '', type: 'percent', value: 0,
    min_order: 0, max_uses: '', valid_from: '',
    valid_until: '', is_active: true
  }

  const typeLabel: Record<string, string> = {
    percent:      '% Off',
    fixed:        'â‚¹ Off',
    free_shipping: 'Free Shipping',
    free_product: 'Free Product',
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs text-white/50">Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1">
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Orders',    href: '/orders' },
            { label: 'Products',  href: '/products' },
            { label: 'Customers', href: '/customers' },
            { label: 'Coupons',   href: '/coupons' },
            { label: 'Banners',   href: '/banners' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1a1008' }}>Coupons & Offers</h1>
          <button onClick={() => setEditing(newCoupon)}
            className="text-white text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: '#c8973a' }}>
            + Create Coupon
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">Loading...</div>
          ) : coupons.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              No coupons yet. Create your first one!
            </div>
          ) : coupons.map(coupon => (
            <div key={coupon.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center min-w-[100px]">
                  <div className="font-mono font-bold text-lg" style={{ color: '#1a1008' }}>
                    {coupon.code}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {typeLabel[coupon.type] || coupon.type}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-800">
                    {coupon.type === 'percent'       && `${coupon.value}% off`}
                    {coupon.type === 'fixed'         && `â‚¹${coupon.value} off`}
                    {coupon.type === 'free_shipping' && 'Free Shipping'}
                    {coupon.type === 'free_product'  && 'Free Product'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-x-3">
                    {coupon.min_order > 0 && <span>Min order â‚¹{coupon.min_order}</span>}
                    {coupon.max_uses && <span>Max {coupon.max_uses} uses</span>}
                    {coupon.valid_until && <span>Expires {new Date(coupon.valid_until).toLocaleDateString('en-IN')}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Used {coupon.uses_count || 0} times
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(coupon.id, coupon.is_active)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    coupon.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  {coupon.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => setEditing(coupon)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Edit
                </button>
                <button onClick={() => deleteCoupon(coupon.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                {editing.id ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light">âœ•</button>
            </div>

            <div className="p-6 space-y-4">
              {msg && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                  {msg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Coupon Code *
                </label>
                <input
                  value={editing.code || ''}
                  onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  placeholder="FIRST10"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
                  <select value={editing.type || 'percent'}
                    onChange={e => setEditing({ ...editing, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="percent">Percentage Off</option>
                    <option value="fixed">Fixed Amount Off</option>
                    <option value="free_shipping">Free Shipping</option>
                    <option value="free_product">Free Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Value {editing.type === 'percent' ? '(%)' : '(â‚¹)'}
                  </label>
                  <input type="number"
                    value={editing.value || ''}
                    onChange={e => setEditing({ ...editing, value: e.target.value })}
                    placeholder={editing.type === 'percent' ? '10' : '75'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Min Order (â‚¹)
                  </label>
                  <input type="number"
                    value={editing.min_order || ''}
                    onChange={e => setEditing({ ...editing, min_order: e.target.value })}
                    placeholder="499"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Max Uses
                  </label>
                  <input type="number"
                    value={editing.max_uses || ''}
                    onChange={e => setEditing({ ...editing, max_uses: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Valid From
                  </label>
                  <input type="date"
                    value={editing.valid_from || ''}
                    onChange={e => setEditing({ ...editing, valid_from: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Valid Until
                  </label>
                  <input type="date"
                    value={editing.valid_until || ''}
                    onChange={e => setEditing({ ...editing, valid_until: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-600">Active</label>
                <button
                  onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    editing.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                    editing.is_active ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={saveCoupon} disabled={saving}
                className="flex-1 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: '#1a1008' }}>
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Create Coupon'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-3 rounded-lg font-semibold bg-gray-100 text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

