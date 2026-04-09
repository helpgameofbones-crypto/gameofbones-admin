'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MarketingPage() {
  const [tab, setTab]           = useState('pixel')
  const [adSpend, setAdSpend]   = useState<any[]>([])
  const [utmLinks, setUtmLinks] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState('')
  const [msg, setMsg]           = useState('')

  const [newSpend, setNewSpend] = useState({
    date: new Date().toISOString().split('T')[0],
    platform: 'meta', campaign_name: '', amount: '',
    impressions: '', clicks: '', orders_attributed: '', revenue_attributed: '', notes: '',
  })

  const [newUtm, setNewUtm] = useState({
    name: '', base_url: 'https://gameofbones.in',
    utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '',
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [spend, utm] = await Promise.all([
      supabase.from('ad_spend').select('*').order('date', { ascending: false }),
      supabase.from('utm_links').select('*').order('created_at', { ascending: false }),
    ])
    setAdSpend(spend.data || [])
    setUtmLinks(utm.data || [])
    setLoading(false)
  }

  async function addAdSpend() {
    if (!newSpend.amount) return
    setSaving(true)
    await supabase.from('ad_spend').insert({
      date: newSpend.date, platform: newSpend.platform,
      campaign_name: newSpend.campaign_name, amount: parseFloat(newSpend.amount),
      impressions: parseInt(newSpend.impressions) || 0, clicks: parseInt(newSpend.clicks) || 0,
      orders_attributed: parseInt(newSpend.orders_attributed) || 0,
      revenue_attributed: parseFloat(newSpend.revenue_attributed) || 0, notes: newSpend.notes,
    })
    setSaving(false)
    setMsg('Saved!')
    setNewSpend({ ...newSpend, campaign_name: '', amount: '', impressions: '', clicks: '', orders_attributed: '', revenue_attributed: '', notes: '' })
    fetchData()
    setTimeout(() => setMsg(''), 2000)
  }

  function buildUtmUrl() {
    const params = new URLSearchParams()
    if (newUtm.utm_source)   params.set('utm_source',   newUtm.utm_source)
    if (newUtm.utm_medium)   params.set('utm_medium',   newUtm.utm_medium)
    if (newUtm.utm_campaign) params.set('utm_campaign', newUtm.utm_campaign)
    if (newUtm.utm_content)  params.set('utm_content',  newUtm.utm_content)
    return newUtm.base_url + '?' + params.toString()
  }

  async function saveUtmLink() {
    if (!newUtm.name || !newUtm.utm_source) return
    setSaving(true)
    await supabase.from('utm_links').insert({ ...newUtm, full_url: buildUtmUrl() })
    setSaving(false)
    setMsg('Saved!')
    setNewUtm({ ...newUtm, name: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' })
    fetchData()
    setTimeout(() => setMsg(''), 2000)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  function exportAdSpend() {
    const rows = [['Date','Platform','Campaign','Spend','Impressions','Clicks','Orders','Revenue','ROAS'],
      ...adSpend.map(s => {
        const roas = s.amount && s.revenue_attributed ? (s.revenue_attributed / s.amount).toFixed(2) + 'x' : '0x'
        return [s.date, s.platform, s.campaign_name || '', s.amount, s.impressions, s.clicks, s.orders_attributed, s.revenue_attributed, roas]
      })
    ]
    const csv = rows.map(r => r.map(c => '"' + c + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'ad-spend.csv'
    a.click()
  }

  const totalSpend   = adSpend.reduce((s, a) => s + (a.amount || 0), 0)
  const totalRevAttr = adSpend.reduce((s, a) => s + (a.revenue_attributed || 0), 0)
  const overallROAS  = totalSpend > 0 ? (totalRevAttr / totalSpend).toFixed(2) : '0'
  const totalClicks  = adSpend.reduce((s, a) => s + (a.clicks || 0), 0)
  const avgCPC       = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0'

  const pixelCode = `<!-- Meta Pixel -->\n<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', 'YOUR_PIXEL_ID');\nfbq('track', 'PageView');\n</script>`

  const ga4Code = `<!-- Google Analytics 4 -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA4_ID"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'YOUR_GA4_ID');\n</script>`

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Campaigns', href: '/campaigns' },
    { label: 'Analytics', href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between" style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {navLinks.map(item => (
            <a key={item.href} href={item.href} className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>{item.label}</a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>Marketing</h1>
        <p className="text-sm mb-6" style={{ color: '#1a1008' }}>Pixel setup, ad spend tracking, UTM links, ROAS</p>

        {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">{msg}</div>}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'pixel', label: 'Meta Pixel' },
            { key: 'ga4', label: 'Google Analytics' },
            { key: 'adspend', label: 'Ad Spend' },
            { key: 'utm', label: 'UTM Builder' },
            { key: 'roas', label: 'ROAS' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: tab === t.key ? '#1a1008' : 'white', color: tab === t.key ? 'white' : '#6b7280', border: '1px solid #e5e7eb' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'pixel' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Meta Pixel Setup</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium mb-1" style={{ color: '#1a1008' }}>Step 1  Get your Pixel ID</p>
                <p className="text-sm" style={{ color: '#1a1008' }}>Go to business.facebook.com  Events Manager  Create Pixel  Copy your Pixel ID</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium" style={{ color: '#1a1008' }}>Step 2  Add to website</p>
                  <button onClick={() => copyToClipboard(pixelCode, 'pixel')}
                    className="text-xs px-3 py-1 rounded font-medium"
                    style={{ background: copied === 'pixel' ? '#dcfce7' : '#f3f4f6', color: copied === 'pixel' ? '#166534' : '#374151' }}>
                    {copied === 'pixel' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="text-xs p-3 rounded bg-gray-900 text-green-400 overflow-x-auto" style={{ maxHeight: 150 }}>{pixelCode}</pre>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm" style={{ color: '#1e40af' }}>
                  In Shopdeck: Website  Web Configuration  Code Snippet  paste pixel code  Save
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'ga4' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Google Analytics 4 Setup</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium mb-1" style={{ color: '#1a1008' }}>Step 1  Create GA4 Property</p>
                <p className="text-sm" style={{ color: '#1a1008' }}>Go to analytics.google.com  Create Account  Create Property  Copy Measurement ID (starts with G-)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium" style={{ color: '#1a1008' }}>Step 2  Add to website</p>
                  <button onClick={() => copyToClipboard(ga4Code, 'ga4')}
                    className="text-xs px-3 py-1 rounded font-medium"
                    style={{ background: copied === 'ga4' ? '#dcfce7' : '#f3f4f6', color: copied === 'ga4' ? '#166534' : '#374151' }}>
                    {copied === 'ga4' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="text-xs p-3 rounded bg-gray-900 text-green-400 overflow-x-auto" style={{ maxHeight: 150 }}>{ga4Code}</pre>
              </div>
            </div>
          </div>
        )}

        {tab === 'adspend' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Log Ad Spend</h3>
              <div className="space-y-3">
                {[
                  { label: 'Date', key: 'date', type: 'date' },
                  { label: 'Campaign Name', key: 'campaign_name', type: 'text', placeholder: 'Summer Sale' },
                  { label: 'Amount Spent (Rs)', key: 'amount', type: 'number', placeholder: '500' },
                  { label: 'Impressions', key: 'impressions', type: 'number', placeholder: '10000' },
                  { label: 'Clicks', key: 'clicks', type: 'number', placeholder: '200' },
                  { label: 'Orders from Ad', key: 'orders_attributed', type: 'number', placeholder: '5' },
                  { label: 'Revenue from Ad', key: 'revenue_attributed', type: 'number', placeholder: '4000' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>{field.label}</label>
                    <input type={field.type} value={(newSpend as any)[field.key]}
                      placeholder={(field as any).placeholder || ''}
                      onChange={e => setNewSpend({ ...newSpend, [field.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Platform</label>
                  <select value={newSpend.platform} onChange={e => setNewSpend({ ...newSpend, platform: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: '#111827' }}>
                    <option value="meta">Meta (Facebook/Instagram)</option>
                    <option value="google">Google Ads</option>
                    <option value="influencer">Influencer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button onClick={addAdSpend} disabled={saving}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : '+ Log Spend'}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <div className="flex justify-between mb-4">
                <div className="text-sm" style={{ color: '#1a1008' }}>{adSpend.length} entries</div>
                <button onClick={exportAdSpend} className="text-white text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#10b981' }}>Export CSV</button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Date','Platform','Campaign','Spend','Clicks','Orders','Revenue','ROAS'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase" style={{ color: '#1a1008' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
                    ) : adSpend.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No ad spend logged yet</td></tr>
                    ) : adSpend.map(entry => {
                      const roas = entry.amount > 0 && entry.revenue_attributed > 0 ? (entry.revenue_attributed / entry.amount).toFixed(1) + 'x' : '-'
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs" style={{ color: '#1a1008' }}>{entry.date}</td>
                          <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-full font-medium text-white capitalize" style={{ background: entry.platform === 'meta' ? '#1877f2' : entry.platform === 'google' ? '#ea4335' : '#6b7280' }}>{entry.platform}</span></td>
                          <td className="px-3 py-3 text-xs" style={{ color: '#1a1008' }}>{entry.campaign_name || '-'}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: '#ef4444' }}>Rs {entry.amount}</td>
                          <td className="px-3 py-3" style={{ color: '#1a1008' }}>{entry.clicks || 0}</td>
                          <td className="px-3 py-3" style={{ color: '#1a1008' }}>{entry.orders_attributed || 0}</td>
                          <td className="px-3 py-3 font-medium" style={{ color: '#10b981' }}>{entry.revenue_attributed > 0 ? 'Rs ' + entry.revenue_attributed : '-'}</td>
                          <td className="px-3 py-3 font-bold" style={{ color: parseFloat(roas) >= 2 ? '#10b981' : '#ef4444' }}>{roas}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'utm' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Build UTM Link</h3>
              <div className="space-y-3">
                {[
                  { label: 'Link Name', key: 'name', placeholder: 'Instagram Bio Link' },
                  { label: 'Destination URL', key: 'base_url', placeholder: 'https://gameofbones.in' },
                  { label: 'Source *', key: 'utm_source', placeholder: 'instagram, google' },
                  { label: 'Medium', key: 'utm_medium', placeholder: 'bio, story, cpc' },
                  { label: 'Campaign', key: 'utm_campaign', placeholder: 'summer_sale' },
                  { label: 'Content', key: 'utm_content', placeholder: 'dog_video' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>{field.label}</label>
                    <input value={(newUtm as any)[field.key]} placeholder={field.placeholder}
                      onChange={e => setNewUtm({ ...newUtm, [field.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: '#111827' }} />
                  </div>
                ))}
                {newUtm.utm_source && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Preview</div>
                    <div className="text-xs break-all" style={{ color: '#3b82f6' }}>{buildUtmUrl()}</div>
                    <button onClick={() => copyToClipboard(buildUtmUrl(), 'preview')}
                      className="mt-2 text-xs px-3 py-1 rounded font-medium"
                      style={{ background: copied === 'preview' ? '#dcfce7' : '#f3f4f6', color: copied === 'preview' ? '#166534' : '#374151' }}>
                      {copied === 'preview' ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                )}
                <button onClick={saveUtmLink} disabled={saving}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50" style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : '+ Save Link'}
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Saved Links</h3>
              <div className="space-y-3">
                {utmLinks.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#2a1f1a' }}>No UTM links yet</div>
                ) : utmLinks.map(link => (
                  <div key={link.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium" style={{ color: '#111827' }}>{link.name}</div>
                      <button onClick={() => copyToClipboard(link.full_url, link.id)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ background: copied === link.id ? '#dcfce7' : '#f3f4f6', color: copied === link.id ? '#166534' : '#374151' }}>
                        {copied === link.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="text-xs break-all" style={{ color: '#3b82f6' }}>{link.full_url}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'roas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Ad Spend',     value: 'Rs ' + totalSpend.toLocaleString('en-IN'),     icon: '', color: '#ef4444' },
                { label: 'Revenue Attributed', value: 'Rs ' + totalRevAttr.toLocaleString('en-IN'),   icon: '', color: '#10b981' },
                { label: 'Overall ROAS',       value: overallROAS + 'x',                              icon: '', color: parseFloat(overallROAS) >= 2 ? '#10b981' : '#ef4444' },
                { label: 'Avg CPC',            value: 'Rs ' + avgCPC,                                icon: '', color: '#3b82f6' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{loading ? '...' : card.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>ROAS Guide</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { range: 'Below 1x', label: 'Losing money',  color: '#ef4444' },
                  { range: '1x - 2x',  label: 'Break even',    color: '#f59e0b' },
                  { range: '2x - 4x',  label: 'Profitable',    color: '#10b981' },
                  { range: 'Above 4x', label: 'Scale this ad!', color: '#8b5cf6' },
                ].map(r => (
                  <div key={r.range} className="p-3 rounded-lg" style={{ background: r.color + '15' }}>
                    <div className="font-bold" style={{ color: r.color }}>{r.range}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#1a1008' }}>{r.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
