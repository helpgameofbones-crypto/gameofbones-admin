'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CampaignsPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [msg, setMsg]             = useState('')
  const [campaign, setCampaign]   = useState({
    type:     'flash_sale',
    subject:  '',
    headline: '',
    body:     '',
    cta:      'Shop Now',
    coupon:   '',
    segment:  'all',
  })

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('name, email, total_orders, total_spent')
      .not('email', 'is', null)
      .neq('email', '')
    setCustomers(data || [])
    setLoading(false)
  }

  const targetCustomers = customers.filter(c => {
    if (campaign.segment === 'all')      return true
    if (campaign.segment === 'vip')      return c.total_spent >= 5000
    if (campaign.segment === 'repeat')   return c.total_orders > 1
    if (campaign.segment === 'new')      return c.total_orders === 1
    if (campaign.segment === 'inactive') return c.total_orders === 0
    return true
  })

  const templates: Record<string, any> = {
    flash_sale: {
      subject:  '⚡ Flash Sale — 20% Off Everything Today Only!',
      headline: 'Flash Sale — 20% Off!',
      body:     'For the next 24 hours only, get 20% off on everything. Use code below at checkout.',
      cta:      'Shop Now',
      coupon:   'FLASH20',
    },
    win_back: {
      subject:  'We miss you! Come back for a special treat 🐾',
      headline: 'Your pup misses Game of Bones!',
      body:     "It's been a while since your last order. We've saved a special discount just for you. Come back and treat your dog!",
      cta:      'Claim Offer',
      coupon:   'COMEBACK15',
    },
    new_product: {
      subject:  '🆕 New Product Alert — Just Launched!',
      headline: 'Something new has arrived!',
      body:     'We just launched a new product your dog will love. Be one of the first to try it!',
      cta:      'Check it Out',
      coupon:   '',
    },
    newsletter: {
      subject:  '🐾 Game of Bones — Monthly Newsletter',
      headline: 'What\'s new at Game of Bones',
      body:     'Here\'s what\'s been happening this month — new products, tips for your dog, and more.',
      cta:      'Read More',
      coupon:   '',
    },
  }

  function applyTemplate(type: string) {
    const t = templates[type]
    setCampaign({ ...campaign, type, ...t })
  }

  async function sendCampaign() {
    if (!campaign.subject || !campaign.headline || !campaign.body) {
      setMsg('Please fill in all fields')
      return
    }
    if (targetCustomers.length === 0) {
      setMsg('No customers match this segment')
      return
    }

    setSending(true)
    setMsg('')

    try {
      const res = await fetch('/api/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: targetCustomers,
          campaign,
        })
      })
      const data = await res.json()
      if (data.ok) {
        setMsg(`✅ Campaign sent to ${data.sent} customers!`)
      } else {
        setMsg('Error: ' + data.error)
      }
    } catch (e) {
      setMsg('Failed to send campaign')
    }
    setSending(false)
  }

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'Orders',      href: '/orders' },
    { label: 'Customers',   href: '/customers' },
    { label: 'Campaigns',   href: '/campaigns' },
    { label: 'Coupons',     href: '/coupons' },
    { label: 'Analytics',   href: '/analytics' },
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

      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Email Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Send targeted emails to your customers in one click
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

        <div className="grid grid-cols-3 gap-6">

          {/* Left — Campaign builder */}
          <div className="col-span-2 space-y-4">

            {/* Templates */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>
                Quick Templates
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'flash_sale',  label: '⚡ Flash Sale',       desc: '24hr discount' },
                  { key: 'win_back',    label: '💌 Win-back',         desc: 'Inactive customers' },
                  { key: 'new_product', label: '🆕 New Product',      desc: 'Product launch' },
                  { key: 'newsletter',  label: '📰 Newsletter',       desc: 'Monthly update' },
                ].map(t => (
                  <button key={t.key} onClick={() => applyTemplate(t.key)}
                    className="text-left p-3 rounded-lg border transition-colors"
                    style={{
                      background: campaign.type === t.key ? '#1a1008' : '#f9fafb',
                      borderColor: campaign.type === t.key ? '#1a1008' : '#e5e7eb',
                      color: campaign.type === t.key ? 'white' : '#374151'
                    }}>
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs mt-0.5" style={{
                      color: campaign.type === t.key ? 'rgba(255,255,255,0.6)' : '#9ca3af'
                    }}>
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Email content */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                Email Content
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                  Subject Line
                </label>
                <input
                  value={campaign.subject}
                  onChange={e => setCampaign({ ...campaign, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                  placeholder="Subject line..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                  Headline
                </label>
                <input
                  value={campaign.headline}
                  onChange={e => setCampaign({ ...campaign, headline: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                  placeholder="Main headline..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                  Body Text
                </label>
                <textarea
                  value={campaign.body}
                  onChange={e => setCampaign({ ...campaign, body: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ color: '#111827' }}
                  placeholder="Email body..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Coupon Code (optional)
                  </label>
                  <input
                    value={campaign.coupon}
                    onChange={e => setCampaign({ ...campaign, coupon: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    style={{ color: '#111827' }}
                    placeholder="FLASH20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Button Text
                  </label>
                  <input
                    value={campaign.cta}
                    onChange={e => setCampaign({ ...campaign, cta: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                    placeholder="Shop Now"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right — Targeting + Send */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>
                Target Segment
              </div>
              <div className="space-y-2">
                {[
                  { key: 'all',      label: 'All customers' },
                  { key: 'vip',      label: 'VIP (₹5000+)' },
                  { key: 'repeat',   label: 'Repeat buyers' },
                  { key: 'new',      label: 'New customers' },
                  { key: 'inactive', label: 'Inactive' },
                ].map(seg => (
                  <button key={seg.key} onClick={() => setCampaign({ ...campaign, segment: seg.key })}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: campaign.segment === seg.key ? '#1a1008' : '#f9fafb',
                      color: campaign.segment === seg.key ? 'white' : '#374151'
                    }}>
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs" style={{ color: '#6b7280' }}>Recipients</div>
              <div className="text-3xl font-bold my-1" style={{ color: '#111827' }}>
                {loading ? '...' : targetCustomers.length}
              </div>
              <div className="text-xs" style={{ color: '#9ca3af' }}>customers with email</div>

              <button
                onClick={sendCampaign}
                disabled={sending || loading}
                className="w-full mt-4 py-3 rounded-lg font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: '#c8973a' }}>
                {sending ? 'Sending...' : `Send to ${targetCustomers.length} customers`}
              </button>

              <p className="text-xs mt-2 text-center" style={{ color: '#9ca3af' }}>
                Only customers with email addresses will receive this
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}