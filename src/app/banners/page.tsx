'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function BannersPage() {
  const [banners, setBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    const { data } = await supabase
      .from('banners')
      .select('*')
      .order('position', { ascending: true })
    setBanners(data || [])
    setLoading(false)
  }

  async function saveBanner() {
    setSaving(true)
    const payload = {
      title:     editing.title,
      subtitle:  editing.subtitle,
      image_url: editing.image_url,
      link_page: editing.link_page,
      position:  Number(editing.position || 0),
      is_active: editing.is_active,
    }
    if (editing.id) {
      await supabase.from('banners').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('banners').insert(payload)
    }
    setMsg('Saved!')
    setSaving(false)
    fetchBanners()
    setTimeout(() => { setEditing(null); setMsg('') }, 800)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('banners').update({ is_active: !current }).eq('id', id)
    fetchBanners()
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return
    await supabase.from('banners').delete().eq('id', id)
    fetchBanners()
  }

  const newBanner = {
    title: '', subtitle: '', image_url: '',
    link_page: 'shop', position: 0, is_active: true
  }

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Products',  href: '/products' },
    { label: 'Customers', href: '/customers' },
    { label: 'Coupons',   href: '/coupons' },
    { label: 'Banners',   href: '/banners' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>

      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>
              Game of Bones
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Admin Panel
            </div>
          </div>
        </div>
        <nav className="flex gap-1">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a1008' }}>Banners</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage homepage banners and announcements
            </p>
          </div>
          <button onClick={() => setEditing(newBanner)}
            className="text-white text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: '#c8973a' }}>
            + Add Banner
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">Loading...</div>
        ) : banners.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">
            No banners yet. Add your first banner!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {banners.map(banner => (
              <div key={banner.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {banner.image_url ? (
                      <img src={banner.image_url} alt={banner.title}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                        ðŸ–¼ï¸
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 truncate">
                      {banner.title || 'Untitled Banner'}
                    </div>
                    <div className="text-sm text-gray-500 truncate mt-0.5">
                      {banner.subtitle}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">
                        Links to: <strong>{banner.link_page}</strong>
                      </span>
                      <span className="text-xs text-gray-400">
                        Position: {banner.position}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(banner.id, banner.is_active)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{
                        background: banner.is_active ? '#dcfce7' : '#f3f4f6',
                        color: banner.is_active ? '#15803d' : '#6b7280'
                      }}>
                      {banner.is_active ? 'Live' : 'Hidden'}
                    </button>
                    <button onClick={() => setEditing(banner)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                      Edit
                    </button>
                    <button onClick={() => deleteBanner(banner.id)}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      style={{ background: '#fef2f2' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                {editing.id ? 'Edit Banner' : 'Add Banner'}
              </h2>
              <button onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light">
                X
              </button>
            </div>

            <div className="p-6 space-y-4">
              {msg && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                  {msg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Image URL
                </label>
                <input
                  value={editing.image_url || ''}
                  onChange={e => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://... paste image link here"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
                {editing.image_url && (
                  <img src={editing.image_url} alt="preview"
                    className="mt-2 w-full h-32 object-cover rounded-lg bg-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Upload your image to Google Drive or Imgur and paste the link here
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                <input
                  value={editing.title || ''}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Summer Sale - 20% Off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subtitle</label>
                <input
                  value={editing.subtitle || ''}
                  onChange={e => setEditing({ ...editing, subtitle: e.target.value })}
                  placeholder="Use code SUMMER20 at checkout"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Links to Page
                  </label>
                  <select
                    value={editing.link_page || 'shop'}
                    onChange={e => setEditing({ ...editing, link_page: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="shop">Shop</option>
                    <option value="about">Our Story</option>
                    <option value="blog">Learn</option>
                    <option value="contact">Contact</option>
                    <option value="home">Home</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Position
                  </label>
                  <input type="number"
                    value={editing.position || 0}
                    onChange={e => setEditing({ ...editing, position: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-600">Show on website</label>
                <button
                  onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className="w-12 h-6 rounded-full transition-colors"
                  style={{ background: editing.is_active ? '#22c55e' : '#d1d5db' }}>
                  <div className="w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5"
                    style={{ transform: editing.is_active ? 'translateX(24px)' : 'translateX(0)' }} />
                </button>
                <span className="text-xs text-gray-500">
                  {editing.is_active ? 'Visible on website' : 'Hidden from website'}
                </span>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={saveBanner} disabled={saving}
                className="flex-1 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: '#1a1008' }}>
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Banner'}
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