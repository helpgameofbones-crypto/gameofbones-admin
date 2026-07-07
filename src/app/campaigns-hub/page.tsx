'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOGO = 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/logo.jpeg'

const FESTIVALS = [
  { name: 'Diwali',       date: '2025-10-20', emoji: '', discount: 20, code: 'DIWALI20'    },
  { name: 'Holi',         date: '2026-03-14', emoji: '', discount: 15, code: 'HOLI15'      },
  { name: 'Christmas',    date: '2025-12-25', emoji: '', discount: 15, code: 'XMAS15'      },
  { name: 'New Year',     date: '2026-01-01', emoji: '', discount: 10, code: 'NY2026'      },
  { name: 'Independence', date: '2025-08-15', emoji: '', discount: 15, code: 'INDIA15'   },
  { name: 'Republic Day', date: '2026-01-26', emoji: '', discount: 10, code: 'REPUBLIC10' },
  { name: 'Pongal',       date: '2026-01-14', emoji: '', discount: 10, code: 'PONGAL10'   },
  { name: 'Eid',          date: '2026-03-31', emoji: '', discount: 15, code: 'EID15'       },
]

function emailWrapper(body: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
      <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
        <img src="${LOGO}" alt="Game of Bones" style="height:80px;width:auto;margin-bottom:12px;border-radius:12px" />
        <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">Premium Natural Dehydrated Treats for Happy Dogs</p>
      </div>
      ${body}
      <div style="background:#1a1008;padding:24px 32px;text-align:center">
        <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
        <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in  WhatsApp: +91 90825 03295</p>
      </div>
    </div>
  `
}

function festivalEmailHtml(name: string, festival: any, coupon: string, customMessage: string) {
  return emailWrapper(`
    <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
      <div style="font-size:56px;margin-bottom:16px">${festival.emoji}</div>
      <h2 style="color:#1a1008;margin:0 0 12px;font-size:26px">Happy ${festival.name}, ${name}!</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
        ${customMessage || `Wishing you and your furry friend a wonderful ${festival.name}! As a special gift, enjoy ${festival.discount}% off on all treats today.`}
      </p>
      ${coupon ? `
      <div style="background:white;border:3px solid #c8973a;border-radius:16px;padding:24px;margin:0 0 24px">
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">${festival.name} Special Offer</p>
        <div style="font-size:40px;font-weight:900;color:#c8973a;letter-spacing:4px">${coupon}</div>
        <p style="margin:8px 0 0;color:#9ca3af;font-size:13px">${festival.discount}% off  valid for 7 days</p>
      </div>` : ''}
      <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
        ${festival.emoji} Shop Now
      </a>
    </div>
  `)
}

function weatherEmailHtml(name: string, weather: any) {
  const isCold  = weather.temp < 20
  const isRainy = weather.desc.toLowerCase().includes('rain')
  const icon    = isCold ? '' : isRainy ? '' : ''
  const headline = isCold
    ? `Cold day? Keep your pup energised, ${name}!`
    : isRainy
    ? `Rainy day treats for your pup, ${name}!`
    : `Perfect weather for a treat, ${name}!`
  const body = isCold
    ? `It's ${weather.temp}C in ${weather.city} today! Cold weather means your dog needs extra energy. Stock up on high-protein treats to keep them warm and active!`
    : isRainy
    ? `It's raining in ${weather.city}! Perfect day to stay in and treat your pup. Order now and we'll deliver right to your door!`
    : `Beautiful ${weather.temp}C day in ${weather.city}! Your dog deserves a treat as great as this weather. Spoil them a little today!`

  return emailWrapper(`
    <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
      <div style="font-size:56px;margin-bottom:16px">${icon}</div>
      <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">${headline}</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">${body}</p>
      <div style="background:white;border-radius:16px;padding:24px;margin:0 0 24px;text-align:left">
        <p style="margin:0 0 12px;font-weight:bold;color:#1a1008"> Perfect treats for today:</p>
        ${[
          isCold  ? ' Chicken Jerky  High protein for extra energy' : ' Fish Treats  Light and refreshing',
          isCold  ? ' Raw Bones  Natural warmth and nutrition'      : ' Goat Organs  Lean and nutritious',
          ' Free delivery on orders above Rs 499',
        ].map(item => `<p style="margin:0 0 8px;color:#374151;font-size:14px">${item}</p>`).join('')}
      </div>
      <a href="https://gameofbones.in" style="background:#3b82f6;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
        Shop Now 
      </a>
    </div>
  `)
}

export default function CampaignsHubPage() {
  const [tab, setTab]             = useState('festivals')
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [weather, setWeather]     = useState<any>(null)
  const [replenishment, setReplenishment] = useState<any[]>([])
  const [previewHtml, setPreviewHtml]     = useState<string | null>(null)

  const [festivalCampaign, setFestivalCampaign] = useState({
    festival:      '',
    customMessage: '',
    segment:       'all',
  })

  useEffect(() => {
    fetchData()
    fetchWeather()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [cust, prods, orders] = await Promise.all([
      supabase.from('customers').select('name, email, phone, total_orders, total_spent').not('email', 'is', null),
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('orders').select('items, created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ])

    const productsData = prods.data || []
    const ordersData   = orders.data || []

    // Order items are saved with `product_name`/`quantity` keys, not `name`/`qty`.
    const salesMap: Record<string, number> = {}
    ordersData.forEach(o => {
      ;(o.items || []).forEach((item: any) => {
        const key = item.name ?? item.product_name
        if (!key) return
        salesMap[key] = (salesMap[key] || 0) + (item.qty ?? item.quantity ?? 1)
      })
    })

    const replen = productsData.map(p => {
      const monthlySales = salesMap[p.name] || 0
      const dailySales   = monthlySales / 30
      const daysLeft     = dailySales > 0 ? Math.round(p.stock / dailySales) : 999
      const reorderQty   = Math.ceil(monthlySales * 1.5)
      return { ...p, monthlySales, daysLeft, reorderQty }
    }).filter(p => p.daysLeft <= 14 && p.daysLeft < 999)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    setCustomers(cust.data || [])
    setReplenishment(replen)
    setLoading(false)
  }

  async function fetchWeather() {
    try {
      const res  = await fetch('https://wttr.in/Mumbai?format=j1')
      const data = await res.json()
      setWeather({
        temp: parseInt(data.current_condition[0].temp_C),
        desc: data.current_condition[0].weatherDesc[0].value,
        city: 'Mumbai'
      })
    } catch {
      setWeather({ temp: 28, desc: 'Partly cloudy', city: 'Mumbai' })
    }
  }

  async function sendFestivalCampaign() {
    if (!festivalCampaign.festival) return
    setSaving(true)

    const festival = FESTIVALS.find(f => f.name === festivalCampaign.festival)
    if (!festival) return

    const targetCustomers = customers.filter(c => {
      if (festivalCampaign.segment === 'all')    return true
      if (festivalCampaign.segment === 'vip')    return c.total_spent >= 5000
      if (festivalCampaign.segment === 'repeat') return c.total_orders > 1
      return true
    })

    const couponCode = festival.code + new Date().getFullYear()

    await supabase.from('coupons').insert({
      code:        couponCode,
      type:        'percent',
      value:       festival.discount,
      min_order:   499,
      max_uses:    1000,
      valid_from:  new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      is_active:   true,
    }).single()

    const res = await fetch('/api/send-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customers: targetCustomers,
        campaign: {
          type:         'festival',
          subject:      `${festival.emoji} Happy ${festival.name}! ${festival.discount}% off for you `,
          headline:     `Happy ${festival.name} from Game of Bones!`,
          body:         '',
          cta:          'Shop Now',
          coupon:       couponCode,
          htmlTemplate: festivalEmailHtml('{{name}}', festival, couponCode, festivalCampaign.customMessage),
          useHtml:      true,
        }
      })
    })

    const data = await res.json()
    setSaving(false)
    setMsg(` ${festival.name} campaign sent to ${data.sent} customers! Code: ${couponCode}`)
    setTimeout(() => setMsg(''), 5000)
  }

  async function sendWeatherCampaign() {
    if (!weather) return
    setSaving(true)

    const isCold  = weather.temp < 20
    const isRainy = weather.desc.toLowerCase().includes('rain')
    const subject = isCold
      ? ` Cold day? Keep your pup energised!`
      : isRainy
      ? ` Rainy day treats for your pup!`
      : ` Perfect weather for a treat! `

    const res = await fetch('/api/send-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customers: customers.filter(c => c.email),
        campaign: {
          type:         'weather',
          subject,
          headline:     subject,
          body:         '',
          cta:          'Shop Now',
          coupon:       '',
          htmlTemplate: weatherEmailHtml('{{name}}', weather),
          useHtml:      true,
        }
      })
    })

    const data = await res.json()
    setSaving(false)
    setMsg(` Weather campaign sent to ${data.sent} customers!`)
    setTimeout(() => setMsg(''), 5000)
  }

  const daysUntil = (dateStr: string) => {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  const navLinks = [
    { label: 'Dashboard',  href: '/dashboard' },
    { label: 'Campaigns',  href: '/campaigns' },
    { label: 'Campaigns+', href: '/campaigns-hub' },
    { label: 'Marketing',  href: '/marketing' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Game of Bones" style={{ height: 40, borderRadius: 8 }} />
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Campaigns Hub</h1>
          <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
            Festival offers, weather campaigns, stock replenishment
          </p>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'festivals',     label: ' Festival Offers' },
            { key: 'weather',       label: ' Weather Campaigns' },
            { key: 'replenishment', label: ` Restock Alerts (${replenishment.length})` },
            { key: 'cod_limiter',   label: ' COD Limiter' },
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

        {/* Festival Offers */}
        {tab === 'festivals' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {FESTIVALS.map(f => {
                  const days = daysUntil(f.date)
                  return (
                    <div key={f.name}
                      className="bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all"
                      style={{
                        borderColor: festivalCampaign.festival === f.name ? '#c8973a' : '#f3f4f6',
                        background:  festivalCampaign.festival === f.name ? '#fefce8' : 'white'
                      }}
                      onClick={() => setFestivalCampaign({ ...festivalCampaign, festival: f.name })}>
                      <div style={{ fontSize: 28 }}>{f.emoji}</div>
                      <div className="font-medium text-sm mt-1" style={{ color: '#111827' }}>{f.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#c8973a' }}>{f.discount}% OFF</div>
                      <div className="text-xs mt-0.5"
                        style={{ color: days < 0 ? '#9ca3af' : days < 30 ? '#ef4444' : '#6b7280' }}>
                        {days < 0 ? 'Past' : days === 0 ? 'Today!' : `${days} days`}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {festivalCampaign.festival && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-xs font-semibold uppercase" style={{ color: '#1a1008' }}>
                      Email Preview
                    </div>
                    <button
                      onClick={() => {
                        const f = FESTIVALS.find(f => f.name === festivalCampaign.festival)
                        if (f) setPreviewHtml(festivalEmailHtml('Rahul', f, f.code, festivalCampaign.customMessage))
                      }}
                      className="text-xs px-3 py-1 rounded font-medium"
                      style={{ background: '#f3f4f6', color: '#1a1008' }}>
                       Full Preview
                    </button>
                  </div>
                  <div className="text-xs p-2 rounded" style={{ background: '#f9fafb', color: '#1a1008' }}>
                    <strong>Subject:</strong> {FESTIVALS.find(f => f.name === festivalCampaign.festival)?.emoji} Happy {festivalCampaign.festival}! {FESTIVALS.find(f => f.name === festivalCampaign.festival)?.discount}% off for you 
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Send Festival Campaign</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Selected Festival</label>
                  <div className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: '#f9fafb', color: festivalCampaign.festival ? '#111827' : '#9ca3af' }}>
                    {festivalCampaign.festival
                      ? FESTIVALS.find(f => f.name === festivalCampaign.festival)?.emoji + ' ' + festivalCampaign.festival
                      : 'Click a festival to select'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Segment</label>
                  <select value={festivalCampaign.segment}
                    onChange={e => setFestivalCampaign({ ...festivalCampaign, segment: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}>
                    <option value="all">All customers ({customers.length})</option>
                    <option value="vip">VIP customers</option>
                    <option value="repeat">Repeat buyers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                    Custom Message (optional)
                  </label>
                  <textarea value={festivalCampaign.customMessage}
                    onChange={e => setFestivalCampaign({ ...festivalCampaign, customMessage: e.target.value })}
                    placeholder="Leave blank to use default message..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    style={{ color: '#111827' }}
                  />
                </div>
                <button onClick={sendFestivalCampaign}
                  disabled={saving || !festivalCampaign.festival}
                  className="w-full py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#c8973a' }}>
                  {saving ? 'Sending...' : ' Send Festival Campaign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weather Campaigns */}
        {tab === 'weather' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Current Weather  Mumbai</h3>
              {weather ? (
                <div className="text-center py-6">
                  <div style={{ fontSize: 64 }}>
                    {weather.temp < 20 ? '' : weather.desc.toLowerCase().includes('rain') ? '' : ''}
                  </div>
                  <div className="text-4xl font-bold mt-2" style={{ color: '#1a1008' }}>{weather.temp}C</div>
                  <div className="text-sm mt-1" style={{ color: '#1a1008' }}>{weather.desc}</div>
                  <div className="mt-4 p-3 rounded-lg" style={{ background: '#f9fafb' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Suggested Campaign</div>
                    <div className="text-sm" style={{ color: '#1a1008' }}>
                      {weather.temp < 20
                        ? ' Cold weather  promote high-protein treats for energy'
                        : weather.desc.toLowerCase().includes('rain')
                        ? ' Rainy day  promote cozy indoor treats'
                        : ' Nice weather  promote outdoor activity treats'}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setPreviewHtml(weatherEmailHtml('Rahul', weather))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: '#f3f4f6', color: '#1a1008' }}>
                       Preview
                    </button>
                    <button onClick={sendWeatherCampaign} disabled={saving}
                      className="flex-1 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                      style={{ background: '#3b82f6' }}>
                      {saving ? 'Sending...' : ' Send Campaign'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: '#2a1f1a' }}>Loading weather...</div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Weather Campaign Ideas</h3>
              <div className="space-y-3">
                {[
                  { temp: 'Below 15C', icon: '', idea: 'High-protein treats for extra energy in cold', color: '#3b82f6' },
                  { temp: '15-25C',    icon: '', idea: 'Perfect weather  general promotion',          color: '#10b981' },
                  { temp: 'Above 35C', icon: '', idea: 'Cool fish treats for hot summer days',         color: '#ef4444' },
                  { temp: 'Rainy',      icon: '', idea: 'Stay-in treats  free delivery promotion',    color: '#1a1008' },
                  { temp: 'Festive',    icon: '', idea: 'Festival-aligned treat bundles',              color: '#f59e0b' },
                ].map(item => (
                  <div key={item.temp} className="flex items-start gap-3 p-3 rounded-lg"
                    style={{ background: item.color + '10' }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: item.color }}>{item.temp}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#1a1008' }}>{item.idea}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stock Replenishment */}
        {tab === 'replenishment' && (
          <div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-sm" style={{ color: '#92400e' }}>
                 These products will run out within 14 days based on current sales rate.
              </p>
            </div>
            {replenishment.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#2a1f1a' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}></div>
                <div className="font-medium" style={{ color: '#1a1008' }}>All products are well stocked</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Product','Current Stock','Daily Sales','Days Left','Reorder Qty','Urgency'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                          style={{ color: '#1a1008' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {replenishment.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50"
                        style={{ background: product.daysLeft <= 3 ? '#fef2f2' : product.daysLeft <= 7 ? '#fefce8' : 'white' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{product.name}</td>
                        <td className="px-4 py-3 font-bold text-xl"
                          style={{ color: product.daysLeft <= 3 ? '#ef4444' : '#f59e0b' }}>
                          {product.stock}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#1a1008' }}>
                          {(product.monthlySales / 30).toFixed(1)}/day
                        </td>
                        <td className="px-4 py-3 font-bold"
                          style={{ color: product.daysLeft <= 3 ? '#ef4444' : product.daysLeft <= 7 ? '#f59e0b' : '#374151' }}>
                          {product.daysLeft} days
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#1a1008' }}>
                          {product.reorderQty} units
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              background: product.daysLeft <= 3 ? '#fef2f2' : product.daysLeft <= 7 ? '#fef3c7' : '#fefce8',
                              color: product.daysLeft <= 3 ? '#ef4444' : '#92400e'
                            }}>
                            {product.daysLeft <= 3 ? ' Critical' : product.daysLeft <= 7 ? ' Urgent' : ' Soon'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COD Limiter */}
        {tab === 'cod_limiter' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-2" style={{ color: '#111827' }}>COD Order Value Limiter</h3>
              <p className="text-sm mb-4" style={{ color: '#1a1008' }}>
                COD orders above 1500 are automatically blocked. This reduces RTO risk on high-value orders.
              </p>
              <div className="p-4 rounded-xl mb-4" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}></span>
                  <div>
                    <div className="font-medium text-sm" style={{ color: '#166534' }}>COD Limiter Active</div>
                    <div className="text-xs" style={{ color: '#166534' }}>COD blocked for orders above 1,500</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg" style={{ background: '#f9fafb' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>How it works</div>
                  <div className="text-xs" style={{ color: '#1a1008', lineHeight: 1.6 }}>
                    When a customer tries to place a COD order above 1,500 it is automatically blocked at the API level.
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: '#fef3c7' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>Why 1,500?</div>
                  <div className="text-xs" style={{ color: '#92400e', lineHeight: 1.6 }}>
                    High-value COD orders have a much higher RTO rate. Blocking them saves you shipping and return costs.
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>COD Risk Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'COD limit',         value: '1,500', icon: '', color: '#ef4444' },
                  { label: 'Max COD exposure',  value: '1,500', icon: '', color: '#f59e0b' },
                  { label: 'Orders above limit', value: 'Blocked', icon: '', color: '#10b981' },
                  { label: 'Prepaid encouraged', value: 'Always',  icon: '', color: '#3b82f6' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center p-3 rounded-lg"
                    style={{ background: '#f9fafb' }}>
                    <div className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span className="text-sm" style={{ color: '#1a1008' }}>{item.label}</span>
                    </div>
                    <span className="font-bold text-sm" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-bold" style={{ color: '#111827' }}>Email Preview</div>
              <button onClick={() => setPreviewHtml(null)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}></button>
            </div>
            <div className="p-4">
              <div className="rounded-xl overflow-hidden border border-gray-200"
                dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
