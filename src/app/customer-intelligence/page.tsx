'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CustomerIntelligencePage() {
  const [tab, setTab]               = useState('import')
  const [customers, setCustomers]   = useState<any[]>([])
  const [orders, setOrders]         = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [products, setProducts]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [importData, setImportData] = useState('')
  const [mergePhone1, setMergePhone1] = useState('')
  const [mergePhone2, setMergePhone2] = useState('')

  const [newSub, setNewSub] = useState({
    customer_phone: '', product_id: '', size_label: '',
    frequency_days: '30', next_order_date: ''
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [cust, ords, subs, prods] = await Promise.all([
      supabase.from('customers').select('*').order('total_spent', { ascending: false }),
      supabase.from('orders').select('customer_phone, created_at, grand_total, items, status').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, price, product_sizes(*)').eq('is_active', true).order('name'),
    ])
    setCustomers(cust.data || [])
    setOrders(ords.data || [])
    setSubscriptions(subs.data || [])
    setProducts(prods.data || [])
    setLoading(false)
  }

  async function importCustomers() {
    if (!importData.trim()) return
    setSaving(true)
    const lines = importData.trim().split('\n')
    let imported = 0
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim().replace(/"/g, ''))
      if (parts.length < 2) continue
      const [name, phone, email, city, state] = parts
      if (!name || !phone) continue
      const { data: existing } = await supabase.from('customers').select('id').eq('phone', phone).single()
      if (existing) continue
      await supabase.from('customers').insert({
        name, phone, email: email || null, city: city || null, state: state || null,
        total_orders: 0, total_spent: 0,
      })
      imported++
    }
    setSaving(false)
    setMsg(`âœ… Imported ${imported} customers!`)
    setImportData('')
    fetchData()
    setTimeout(() => setMsg(''), 4000)
  }

  async function mergeCustomers() {
    if (!mergePhone1 || !mergePhone2) return
    const c1 = customers.find(c => c.phone === mergePhone1)
    const c2 = customers.find(c => c.phone === mergePhone2)
    if (!c1 || !c2) { setMsg('âŒ Customer not found'); return }
    setSaving(true)
    await supabase.from('customers').update({
      total_orders: c1.total_orders + c2.total_orders,
      total_spent:  c1.total_spent + c2.total_spent,
      notes: [c1.notes, c2.notes].filter(Boolean).join(' | '),
    }).eq('id', c1.id)
    await supabase.from('customers').delete().eq('id', c2.id)
    setSaving(false)
    setMsg(`âœ… Merged ${c2.name} into ${c1.name}`)
    setMergePhone1('')
    setMergePhone2('')
    fetchData()
    setTimeout(() => setMsg(''), 4000)
  }

  async function addSubscription() {
    if (!newSub.customer_phone || !newSub.product_id) return
    setSaving(true)
    const customer  = customers.find(c => c.phone === newSub.customer_phone)
    const product   = products.find(p => p.id === newSub.product_id)
    const size      = product?.product_sizes?.find((s: any) => s.label === newSub.size_label)
    await supabase.from('subscriptions').insert({
      customer_phone: newSub.customer_phone,
      customer_name:  customer?.name || '',
      customer_email: customer?.email || '',
      product_id:     newSub.product_id,
      product_name:   product?.name || '',
      size_label:     newSub.size_label,
      price:          size?.price || product?.price || 0,
      frequency_days: parseInt(newSub.frequency_days) || 30,
      next_order_date: newSub.next_order_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      is_active:      true,
    })
    setSaving(false)
    setMsg('âœ… Subscription created!')
    setNewSub({ customer_phone: '', product_id: '', size_label: '', frequency_days: '30', next_order_date: '' })
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleSubscription(id: string, current: boolean) {
    await supabase.from('subscriptions').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  // Reorder prediction
  const reorderPredictions = customers.map(c => {
    const customerOrders = orders.filter(o => o.customer_phone === c.phone)
    if (customerOrders.length < 2) return null
    const sorted     = customerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const lastOrder  = new Date(sorted[0].created_at)
    const gaps       = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = (new Date(sorted[i].created_at).getTime() - new Date(sorted[i+1].created_at).getTime()) / 86400000
      gaps.push(diff)
    }
    const avgGap     = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const nextOrder  = new Date(lastOrder.getTime() + avgGap * 86400000)
    const daysLeft   = Math.round((nextOrder.getTime() - Date.now()) / 86400000)
    const lastItems  = sorted[0].items?.slice(0,2).map((i: any) => i.name).join(', ') || ''
    return { customer: c, avgGap: Math.round(avgGap), nextOrder, daysLeft, lastItems }
  }).filter(Boolean).sort((a: any, b: any) => a.daysLeft - b.daysLeft)

  // Customer acquisition cost
  const totalAdSpend30 = 0 // Will pull from ad_spend table when available
  const newCustomers30 = customers.filter(c => {
    const d = new Date(c.created_at)
    return d >= new Date(Date.now() - 30 * 86400000)
  }).length
  const cac = newCustomers30 > 0 && totalAdSpend30 > 0
    ? Math.round(totalAdSpend30 / newCustomers30)
    : null

  // Repeat purchase interval
  const repeatCustomers = customers.filter(c => c.total_orders > 1)
  const intervals = repeatCustomers.map(c => {
    const custOrders = orders.filter(o => o.customer_phone === c.phone)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    if (custOrders.length < 2) return null
    const gaps = []
    for (let i = 1; i < custOrders.length; i++) {
      const diff = (new Date(custOrders[i].created_at).getTime() - new Date(custOrders[i-1].created_at).getTime()) / 86400000
      gaps.push(diff)
    }
    return gaps.reduce((s, g) => s + g, 0) / gaps.length
  }).filter(Boolean) as number[]
  const avgRepeatInterval = intervals.length
    ? Math.round(intervals.reduce((s, i) => s + i, 0) / intervals.length)
    : null

  const navLinks = [
    { label: 'Dashboard',      href: '/dashboard' },
    { label: 'Customers',      href: '/customers' },
    { label: 'Cust Intel',     href: '/customer-intelligence' },
    { label: 'Loyalty',        href: '/loyalty' },
    { label: 'Analytics',      href: '/analytics' },
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Customer Intelligence</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Import, merge, subscriptions, reorder prediction, acquisition cost
          </p>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('âœ…') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('âœ…') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('âœ…') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'import',       label: 'ðŸ“¥ Import' },
            { key: 'merge',        label: 'ðŸ”€ Merge' },
            { key: 'subscriptions', label: `ðŸ”„ Subscriptions (${subscriptions.filter(s=>s.is_active).length})` },
            { key: 'reorder',      label: 'ðŸ”® Reorder Prediction' },
            { key: 'metrics',      label: 'ðŸ“Š Metrics' },
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

        {/* Import */}
        {tab === 'import' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-2" style={{ color: '#111827' }}>Import Customers from CSV</h3>
              <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
                Format: Name, Phone, Email, City, State (one per line)
              </p>
              <textarea
                value={importData}
                onChange={e => setImportData(e.target.value)}
                placeholder="Rahul Sharma, 9876543210, rahul@email.com, Mumbai, Maharashtra&#10;Priya Patel, 9876543211, priya@email.com, Delhi, Delhi"
                rows={10}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none font-mono"
                style={{ color: '#111827' }}
              />
              <button onClick={importCustomers} disabled={saving}
                className="w-full mt-3 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1008' }}>
                {saving ? 'Importing...' : 'ðŸ“¥ Import Customers'}
              </button>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>CSV Format Guide</h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg font-mono text-xs" style={{ background: '#f9fafb', color: '#374151' }}>
                  Name, Phone, Email, City, State
                </div>
                <div className="space-y-1">
                  {[
                    { field: 'Name',  req: true,  note: 'Full name' },
                    { field: 'Phone', req: true,  note: '10-digit mobile number' },
                    { field: 'Email', req: false, note: 'Optional' },
                    { field: 'City',  req: false, note: 'Optional' },
                    { field: 'State', req: false, note: 'Optional' },
                  ].map(f => (
                    <div key={f.field} className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: f.req ? '#fef3c7' : '#f3f4f6', color: f.req ? '#92400e' : '#6b7280' }}>
                        {f.req ? 'Required' : 'Optional'}
                      </span>
                      <span className="font-medium text-xs" style={{ color: '#374151' }}>{f.field}</span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>â€” {f.note}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-lg" style={{ background: '#f0fdf4' }}>
                  <p className="text-xs" style={{ color: '#166534' }}>
                    âœ… Duplicate phone numbers are automatically skipped
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Merge */}
        {tab === 'merge' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-2" style={{ color: '#111827' }}>Merge Duplicate Customers</h3>
              <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
                Merges all orders and data from Customer 2 into Customer 1.
                Customer 2 will be deleted.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Keep this customer (Phone)
                  </label>
                  <input value={mergePhone1} onChange={e => setMergePhone1(e.target.value)}
                    placeholder="9876543210"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  {mergePhone1 && customers.find(c => c.phone === mergePhone1) && (
                    <div className="mt-1 text-xs" style={{ color: '#10b981' }}>
                      âœ… {customers.find(c => c.phone === mergePhone1)?.name}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    Delete this customer (Phone)
                  </label>
                  <input value={mergePhone2} onChange={e => setMergePhone2(e.target.value)}
                    placeholder="9876543211"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  {mergePhone2 && customers.find(c => c.phone === mergePhone2) && (
                    <div className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                      âš ï¸ {customers.find(c => c.phone === mergePhone2)?.name} will be deleted
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-lg" style={{ background: '#fef2f2' }}>
                  <p className="text-xs" style={{ color: '#ef4444' }}>
                    âš ï¸ This action cannot be undone. The second customer profile will be permanently deleted.
                  </p>
                </div>
                <button onClick={mergeCustomers} disabled={saving || !mergePhone1 || !mergePhone2}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#ef4444' }}>
                  {saving ? 'Merging...' : 'ðŸ”€ Merge Customers'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Possible Duplicates</h3>
              <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                Customers with similar names that might be duplicates
              </p>
              {customers.filter((c, i) =>
                customers.some((c2, j) => j !== i &&
                  c2.name.toLowerCase().split(' ')[0] === c.name.toLowerCase().split(' ')[0] &&
                  c2.phone !== c.phone)
              ).slice(0, 6).map(c => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#111827' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{c.phone}</div>
                  </div>
                  <button onClick={() => { setMergePhone2(c.phone) }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: '#fef2f2', color: '#ef4444' }}>
                    Flag
                  </button>
                </div>
              ))}
              {customers.filter((c, i) =>
                customers.some((c2, j) => j !== i &&
                  c2.name.toLowerCase().split(' ')[0] === c.name.toLowerCase().split(' ')[0] &&
                  c2.phone !== c.phone)
              ).length === 0 && (
                <div style={{ color: '#9ca3af', fontSize: 14 }}>No obvious duplicates found</div>
              )}
            </div>
          </div>
        )}

        {/* Subscriptions */}
        {tab === 'subscriptions' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Add Subscription</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Customer Phone *</label>
                  <input value={newSub.customer_phone}
                    onChange={e => setNewSub({ ...newSub, customer_phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  {newSub.customer_phone && customers.find(c => c.phone === newSub.customer_phone) && (
                    <div className="mt-1 text-xs" style={{ color: '#10b981' }}>
                      âœ… {customers.find(c => c.phone === newSub.customer_phone)?.name}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Product *</label>
                  <select value={newSub.product_id}
                    onChange={e => setNewSub({ ...newSub, product_id: e.target.value, size_label: '' })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}>
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {newSub.product_id && (
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Size</label>
                    <select value={newSub.size_label}
                      onChange={e => setNewSub({ ...newSub, size_label: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}>
                      <option value="">Select size...</option>
                      {products.find(p => p.id === newSub.product_id)?.product_sizes?.map((s: any) => (
                        <option key={s.id} value={s.label}>{s.label} â€” â‚¹{s.price}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Frequency (days)</label>
                  <select value={newSub.frequency_days}
                    onChange={e => setNewSub({ ...newSub, frequency_days: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}>
                    <option value="7">Every week</option>
                    <option value="14">Every 2 weeks</option>
                    <option value="30">Every month</option>
                    <option value="60">Every 2 months</option>
                    <option value="90">Every 3 months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>First Order Date</label>
                  <input type="date" value={newSub.next_order_date}
                    onChange={e => setNewSub({ ...newSub, next_order_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
                <button onClick={addSubscription} disabled={saving}
                  className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : '+ Add Subscription'}
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Customer','Product','Size','Frequency','Next Order','Status','Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                          style={{ color: '#6b7280' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
                    ) : subscriptions.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>
                        No subscriptions yet
                      </td></tr>
                    ) : subscriptions.map(sub => {
                      const isOverdue = sub.next_order_date && new Date(sub.next_order_date) < new Date()
                      return (
                        <tr key={sub.id} className="hover:bg-gray-50"
                          style={{ background: isOverdue && sub.is_active ? '#fef2f2' : 'white' }}>
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: '#111827' }}>{sub.customer_name}</div>
                            <div className="text-xs" style={{ color: '#9ca3af' }}>{sub.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#374151' }}>{sub.product_name}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>{sub.size_label}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>Every {sub.frequency_days}d</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium" style={{ color: isOverdue ? '#ef4444' : '#374151' }}>
                              {sub.next_order_date}
                              {isOverdue && ' âš ï¸'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{
                                background: sub.is_active ? '#dcfce7' : '#f3f4f6',
                                color: sub.is_active ? '#166534' : '#6b7280'
                              }}>
                              {sub.is_active ? 'Active' : 'Paused'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleSubscription(sub.id, sub.is_active)}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{
                                background: sub.is_active ? '#fef2f2' : '#dcfce7',
                                color: sub.is_active ? '#ef4444' : '#166534'
                              }}>
                              {sub.is_active ? 'Pause' : 'Resume'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Reorder Prediction */}
        {tab === 'reorder' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm" style={{ color: '#1e40af' }}>
                Based on each customer's average order interval, we predict when they'll need to reorder.
                Send them a reminder a few days before.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Customer','Last Items','Avg Interval','Predicted Next Order','Days Left','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
                  ) : reorderPredictions.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>
                      Need at least 2 orders per customer to predict reorder date
                    </td></tr>
                  ) : reorderPredictions.map((pred: any) => (
                    <tr key={pred.customer.id} className="hover:bg-gray-50"
                      style={{ background: pred.daysLeft <= 3 ? '#fef2f2' : pred.daysLeft <= 7 ? '#fefce8' : 'white' }}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: '#111827' }}>{pred.customer.name}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>{pred.customer.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>{pred.lastItems}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{pred.avgGap} days</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>
                        {pred.nextOrder.toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-sm"
                          style={{ color: pred.daysLeft <= 0 ? '#ef4444' : pred.daysLeft <= 7 ? '#f59e0b' : '#10b981' }}>
                          {pred.daysLeft <= 0 ? 'Overdue!' : pred.daysLeft + ' days'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`https://wa.me/91${pred.customer.phone}?text=Hi ${pred.customer.name}! Your pup must be running low on treats. Time to restock? ðŸ¾ gameofbones.in`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                          style={{ background: '#25d366', textDecoration: 'none' }}>
                          ðŸ“± WhatsApp
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Metrics */}
        {tab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Customers',      value: customers.length,                                                   icon: 'ðŸ‘¥', color: '#3b82f6' },
                { label: 'Repeat Buyers',        value: customers.filter(c => c.total_orders > 1).length,                   icon: 'ðŸ”„', color: '#10b981' },
                { label: 'Avg Repeat Interval',  value: avgRepeatInterval ? avgRepeatInterval + ' days' : 'N/A',           icon: 'ðŸ“…', color: '#8b5cf6' },
                { label: 'Avg Order Value',      value: orders.length ? 'â‚¹' + Math.round(orders.reduce((s,o) => s+(o.grand_total||0),0)/orders.length).toLocaleString('en-IN') : 'â‚¹0', icon: 'ðŸ’°', color: '#c8973a' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>
                    {loading ? '...' : card.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Top Customers by LTV</h3>
                {customers.slice(0, 8).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                    <span className="text-xs font-bold w-5 text-center" style={{ color: '#c8973a' }}>{i+1}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: '#111827' }}>{c.name}</div>
                      <div className="text-xs" style={{ color: '#9ca3af' }}>{c.total_orders} orders</div>
                    </div>
                    <div className="font-bold text-sm" style={{ color: '#10b981' }}>
                      â‚¹{c.total_spent?.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Win-back Candidates</h3>
                <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                  Customers who ordered before but haven't ordered in 60+ days
                </p>
                {customers.filter(c => {
                  if (c.total_orders === 0) return false
                  const lastOrder = orders.filter(o => o.customer_phone === c.phone)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  if (!lastOrder) return false
                  const daysSince = (Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000
                  return daysSince > 60
                }).slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#111827' }}>{c.name}</div>
                      <div className="text-xs" style={{ color: '#9ca3af' }}>{c.total_orders} orders Â· â‚¹{c.total_spent}</div>
                    </div>
                    <a href={`https://wa.me/91${c.phone}?text=Hi ${c.name}! We miss you at Game of Bones ðŸ¾ Come back for a special offer!`}
                      target="_blank" rel="noreferrer"
                      className="text-xs px-2 py-1 rounded font-medium text-white"
                      style={{ background: '#25d366', textDecoration: 'none' }}>
                      WhatsApp
                    </a>
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