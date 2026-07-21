'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ENCRYPTION_KEY = 'gob_secret_2024_gameofbones_in_kalyan';
function decryptData(encrypted: string): string {
  if (!encrypted) return '';
  try {
    const binary = atob(encrypted);
    let result = '';
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}
function decryptPhone(raw: string): string {
  if (!raw) return '';
  if (/^\+?\d{10,13}$/.test(raw)) return raw;
  const dec = decryptData(raw);
  return /^\+?\d{10,13}$/.test(dec) ? dec : raw;
}

export default function GamificationPage() {
  const [tab, setTab]             = useState('leaderboard')
  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders]       = useState<any[]>([])
  const [rewards, setRewards]     = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [streaks, setStreaks]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [spinPhone, setSpinPhone] = useState('')
  const [spinning, setSpinning]   = useState(false)
  const [spinResult, setSpinResult] = useState<any>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [cust, ords, rew, mil, str] = await Promise.all([
      supabase.from('customers').select('*').order('total_spent', { ascending: false }),
      supabase.from('orders').select('customer_phone, created_at, grand_total, status').order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('milestones').select('*').order('order_count'),
      supabase.from('streaks').select('*').order('current_streak', { ascending: false }),
    ])
    setCustomers(cust.data || [])
    setOrders(ords.data || [])
    setRewards(rew.data || [])
    setMilestones(mil.data || [])
    setStreaks(str.data || [])
    setLoading(false)
  }

  async function spinWheel(phone: string) {
    if (!phone) return
    setSpinning(true)
    setSpinResult(null)

    const prizes = [
      { label: '10% OFF',     code: 'SPIN10',  value: 10,  probability: 30 },
      { label: '15% OFF',     code: 'SPIN15',  value: 15,  probability: 25 },
      { label: '20% OFF',     code: 'SPIN20',  value: 20,  probability: 20 },
      { label: 'Free Ship',   code: 'SPINFS',  value: 0,   probability: 15 },
      { label: '25% OFF',     code: 'SPIN25',  value: 25,  probability: 8  },
      { label: '30% OFF',     code: 'SPIN30',  value: 30,  probability: 2  },
    ]

    const rand  = Math.random() * 100
    let cumulative = 0
    let prize = prizes[0]
    for (const p of prizes) {
      cumulative += p.probability
      if (rand < cumulative) { prize = p; break }
    }

    await new Promise(r => setTimeout(r, 2000))

    const customer  = customers.find(c => c.phone === phone)
    const coupon    = prize.code + Date.now().toString(36).slice(-4).toUpperCase()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    if (prize.value > 0) {
      await supabase.from('coupons').insert({
        code:        coupon,
        type:        'percent',
        value:       prize.value,
        min_order:   499,
        max_uses:    1,
        valid_from:  new Date().toISOString().split('T')[0],
        valid_until: expiresAt.toISOString().split('T')[0],
        is_active:   true,
      })
    }

    await supabase.from('rewards').insert({
      customer_phone: phone,
      customer_name:  customer?.name || phone,
      type:           'spin_wheel',
      description:    prize.label,
      coupon_code:    coupon,
      discount_value: prize.value,
      expires_at:     expiresAt.toISOString(),
    })

    setSpinResult({ ...prize, coupon, customer })
    setSpinning(false)
    fetchData()
  }

  async function checkMilestones(phone: string) {
    const customer = customers.find(c => c.phone === phone)
    if (!customer) return

    const orderCount = customer.total_orders
    const milestone  = milestones.find(m => m.order_count === orderCount && m.is_active)
    if (!milestone) {
      setMsg(`No milestone at ${orderCount} orders`)
      return
    }

    const coupon = milestone.coupon_code + Date.now().toString(36).slice(-4).toUpperCase()
    if (milestone.discount_percent > 0) {
      await supabase.from('coupons').insert({
        code:        coupon,
        type:        'percent',
        value:       milestone.discount_percent,
        min_order:   0,
        max_uses:    1,
        valid_from:  new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        is_active:   true,
      })
    }

    await supabase.from('rewards').insert({
      customer_phone: phone,
      customer_name:  customer.name,
      type:           'milestone',
      description:    milestone.reward_description,
      coupon_code:    coupon,
      discount_value: milestone.discount_percent,
    })

    setMsg(` Milestone reward sent to ${customer.name}!`)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function updateStreaks() {
    setSaving(true)
    const currentMonth = new Date().toISOString().slice(0, 7)

    for (const customer of customers) {
      // orders.customer_phone may be XOR+base64 encrypted while customers.phone is
      // plain text — decrypt before comparing, otherwise this only ever matches
      // manual orders (which store phone in plain text) and misses real checkout orders.
      const custOrders = orders.filter(o => decryptPhone(o.customer_phone) === customer.phone)
      if (custOrders.length === 0) continue

      const orderMonths = [...new Set(custOrders.map(o => o.created_at.slice(0, 7)))]
        .sort().reverse()

      let streak = 0
      let month  = currentMonth

      for (const m of orderMonths) {
        if (m === month) {
          streak++
          const d = new Date(month)
          d.setMonth(d.getMonth() - 1)
          month = d.toISOString().slice(0, 7)
        } else break
      }

      const existing = streaks.find(s => s.customer_phone === customer.phone)
      if (existing) {
        await supabase.from('streaks').update({
          current_streak:  streak,
          longest_streak:  Math.max(streak, existing.longest_streak),
          last_order_month: orderMonths[0],
          updated_at:      new Date().toISOString(),
        }).eq('customer_phone', customer.phone)
      } else if (streak > 0) {
        await supabase.from('streaks').insert({
          customer_phone:  customer.phone,
          current_streak:  streak,
          longest_streak:  streak,
          last_order_month: orderMonths[0],
        })
      }
    }
    setSaving(false)
    setMsg(' Streaks updated!')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const topCustomers = customers.slice(0, 10)

  const navLinks = [
    { label: 'Dashboard',     href: '/dashboard' },
    { label: 'Customers',     href: '/customers' },
    { label: 'Gamification',  href: '/gamification' },
    { label: 'Loyalty',       href: '/loyalty' },
    { label: 'Campaigns',     href: '/campaigns' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Gamification</h1>
          <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
            Spin wheel, milestones, streaks, leaderboard
          </p>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('') ? '#166634' : '#ef4444',
              border: `1px solid ${msg.startsWith('') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'leaderboard', label: ' Leaderboard' },
            { key: 'spin',        label: ' Spin Wheel' },
            { key: 'milestones',  label: ' Milestones' },
            { key: 'streaks',     label: ' Streaks' },
            { key: 'rewards',     label: ` Rewards (${rewards.length})` },
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

        {/* Leaderboard */}
        {tab === 'leaderboard' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}> Top by Revenue</h3>
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: i === 0 ? '#fef3c7' : i === 1 ? '#f3f4f6' : i === 2 ? '#fef3c7' : '#f9fafb',
                      color: i === 0 ? '#92400e' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : '#9ca3af'
                    }}>
                    {i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: '#111827' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>{c.total_orders} orders</div>
                  </div>
                  <div className="font-bold" style={{ color: '#10b981' }}>
                    {c.total_spent?.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}> Top by Orders</h3>
              {[...customers].sort((a, b) => b.total_orders - a.total_orders).slice(0, 10).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: i < 3 ? '#fef3c7' : '#f9fafb',
                      color: i < 3 ? '#92400e' : '#9ca3af'
                    }}>
                    {i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: '#111827' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>
                      {c.total_spent?.toLocaleString('en-IN')} total
                    </div>
                  </div>
                  <div className="font-bold" style={{ color: '#3b82f6' }}>
                    {c.total_orders} orders
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spin Wheel */}
        {tab === 'spin' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-2" style={{ color: '#111827' }}> Spin the Wheel</h3>
              <p className="text-sm mb-4" style={{ color: '#1a1008' }}>
                Give a customer a spin after they place an order. They win a random discount code.
              </p>

              <div style={{ fontSize: 80, textAlign: 'center', margin: '20px 0',
                animation: spinning ? 'spin 0.5s linear infinite' : 'none' }}>
                
              </div>

              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                    Customer Phone
                  </label>
                  <select value={spinPhone} onChange={e => setSpinPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}>
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.phone}>{c.name}  {c.phone}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => spinWheel(spinPhone)} disabled={spinning || !spinPhone}
                  className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-50 text-lg"
                  style={{ background: spinning ? '#9ca3af' : '#c8973a' }}>
                  {spinning ? ' Spinning...' : ' Spin!'}
                </button>
              </div>

              {spinResult && (
                <div className="mt-4 p-4 rounded-xl text-center"
                  style={{ background: '#fef3c7', border: '2px dashed #c8973a' }}>
                  <div style={{ fontSize: 36 }}></div>
                  <div className="font-bold text-xl mt-2" style={{ color: '#1a1008' }}>
                    {spinResult.label}
                  </div>
                  <div className="font-mono font-bold text-2xl mt-1" style={{ color: '#c8973a' }}>
                    {spinResult.coupon}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#1a1008' }}>Valid for 48 hours</div>
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs font-semibold mb-2" style={{ color: '#1a1008' }}>Prize Distribution</div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: '10% OFF', prob: '30%', color: '#f59e0b' },
                    { label: '15% OFF', prob: '25%', color: '#f59e0b' },
                    { label: '20% OFF', prob: '20%', color: '#10b981' },
                    { label: 'Free Ship', prob: '15%', color: '#3b82f6' },
                    { label: '25% OFF', prob: '8%',  color: '#8b5cf6' },
                    { label: '30% OFF', prob: '2%',  color: '#ef4444' },
                  ].map(p => (
                    <div key={p.label} className="flex justify-between p-2 rounded text-xs"
                      style={{ background: '#f9fafb' }}>
                      <span style={{ color: p.color, fontWeight: 'bold' }}>{p.label}</span>
                      <span style={{ color: '#2a1f1a' }}>{p.prob}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Recent Spin Results</h3>
              {rewards.filter(r => r.type === 'spin_wheel').slice(0, 10).map(r => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#111827' }}>{r.customer_name}</div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm" style={{ color: '#c8973a' }}>{r.description}</div>
                    <div className="font-mono text-xs" style={{ color: '#1a1008' }}>{r.coupon_code}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {tab === 'milestones' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {milestones.map(m => (
                <div key={m.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    {m.order_count >= 20 ? '' : m.order_count >= 10 ? '' : m.order_count >= 5 ? '' : ''}
                  </div>
                  <div className="font-bold text-2xl" style={{ color: '#c8973a' }}>
                    {m.order_count} orders
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#1a1008' }}>{m.reward_description}</div>
                  <div className="font-mono text-xs mt-1" style={{ color: '#2a1f1a' }}>{m.coupon_code}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Check Customer Milestones</h3>
              <div className="flex gap-3">
                <select
                  onChange={e => checkMilestones(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}>
                  <option value="">Select customer to check milestone...</option>
                  {customers.filter(c => milestones.some(m => m.order_count === c.total_orders)).map(c => (
                    <option key={c.id} value={c.phone}>
                      {c.name}  {c.total_orders} orders  MILESTONE!
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold mb-2" style={{ color: '#1a1008' }}>
                  Customers at milestones right now:
                </div>
                {customers.filter(c => milestones.some(m => m.order_count === c.total_orders)).length === 0 ? (
                  <div style={{ color: '#2a1f1a', fontSize: 13 }}>No customers at milestone order counts right now</div>
                ) : customers.filter(c => milestones.some(m => m.order_count === c.total_orders)).map(c => {
                  const milestone = milestones.find(m => m.order_count === c.total_orders)
                  return (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#111827' }}>{c.name}</div>
                        <div className="text-xs" style={{ color: '#2a1f1a' }}>{c.total_orders} orders</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm" style={{ color: '#c8973a' }}>{milestone?.reward_description}</div>
                        <button onClick={() => checkMilestones(c.phone)}
                          className="text-xs px-3 py-1 rounded-lg font-medium text-white mt-1"
                          style={{ background: '#c8973a' }}>
                          Send Reward
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Streaks */}
        {tab === 'streaks' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm" style={{ color: '#1a1008' }}>
                Customers who order every month maintain a streak. Reward them for consistency.
              </p>
              <button onClick={updateStreaks} disabled={saving}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                style={{ background: '#c8973a' }}>
                {saving ? 'Updating...' : ' Update All Streaks'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Customer','Current Streak','Longest Streak','Last Order Month','Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#1a1008' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
                  ) : streaks.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                      Click "Update All Streaks" to calculate streaks
                    </td></tr>
                  ) : streaks.map(streak => {
                    const customer = customers.find(c => c.phone === streak.customer_phone)
                    return (
                      <tr key={streak.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#111827' }}>
                            {customer?.name || streak.customer_phone}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: 20 }}>
                              {streak.current_streak >= 6 ? '' : streak.current_streak >= 3 ? '' : streak.current_streak >= 1 ? '' : ''}
                            </span>
                            <span className="font-bold text-lg" style={{ color: '#f59e0b' }}>
                              {streak.current_streak}
                            </span>
                            <span className="text-xs" style={{ color: '#2a1f1a' }}>months</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#1a1008' }}>
                          {streak.longest_streak} months
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                          {streak.last_order_month}
                        </td>
                        <td className="px-4 py-3">
                          {streak.current_streak >= 3 ? (
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{ background: '#fef3c7', color: '#92400e' }}>
                               On Fire!
                            </span>
                          ) : streak.current_streak >= 1 ? (
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{ background: '#f0fdf4', color: '#166534' }}>
                              Active
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full"
                              style={{ background: '#f3f4f6', color: '#2a1f1a' }}>
                              Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rewards History */}
        {tab === 'rewards' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Customer','Type','Reward','Coupon','Used','Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                      style={{ color: '#1a1008' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rewards.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                    No rewards given yet
                  </td></tr>
                ) : rewards.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{r.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: '#dbeafe', color: '#1e40af' }}>
                        {r.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#1a1008' }}>{r.description}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#c8973a' }}>{r.coupon_code}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: r.is_used ? '#dcfce7' : '#f3f4f6',
                          color: r.is_used ? '#166534' : '#6b7280'
                        }}>
                        {r.is_used ? 'Used' : 'Unused'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#2a1f1a' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}