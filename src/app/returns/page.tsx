'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ReturnsPage() {
  const [returns, setReturns]   = useState<any[]>([])
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [search, setSearch]     = useState('')
  const [newReturn, setNewReturn] = useState({ order_ref: '', reason: '', refund_amount: '', notes: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [r, o] = await Promise.all([
      supabase.from('returns').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, ref, customer_name, customer_phone, items, grand_total').order('created_at', { ascending: false }).limit(200)
    ])
    setReturns(r.data || [])
    setOrders(o.data || [])
    setLoading(false)
  }

  async function addReturn() {
    if (!newReturn.order_ref || !newReturn.reason) return
    setSaving(true)
    const order = orders.find(o => o.ref.toLowerCase() === newReturn.order_ref.toLowerCase())
    await supabase.from('returns').insert({
      order_id: order?.id, order_ref: newReturn.order_ref.toUpperCase(),
      customer_name: order?.customer_name || '', customer_phone: order?.customer_phone || '',
      reason: newReturn.reason, refund_amount: parseFloat(newReturn.refund_amount) || 0,
      notes: newReturn.notes, items: order?.items || [], status: 'requested',
    })
    setSaving(false)
    setShowAdd(false)
    setNewReturn({ order_ref: '', reason: '', refund_amount: '', notes: '' })
    setMsg('Return logged!')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function updateReturnStatus(id: string, status: string) {
    await supabase.from('returns').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (status === 'approved') {
      const ret = returns.find(r => r.id === id)
      if (ret?.order_id) await supabase.from('orders').update({ status: 'rto' }).eq('id', ret.order_id)
    }
    fetchData()
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  const filtered = returns.filter(r =>
    !search || r.order_ref?.toLowerCase().includes(search.toLowerCase()) || r.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const statusColors: Record<string, { bg: string; color: string }> = {
    requested: { bg: '#fef3c7', color: '#92400e' },
    approved:  { bg: '#dcfce7', color: '#166534' },
    rejected:  { bg: '#fef2f2', color: '#ef4444' },
    completed: { bg: '#dbeafe', color: '#1e40af' },
  }

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
        <nav className="flex gap-1">
          {[['Dashboard','/dashboard'],['Orders','/orders'],['Returns','/returns'],['Finance','/finance']].map(([l,h]) => (
            <a key={h} href={h} className="px-3 py-2 rounded text-sm hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.8)' }}>{l}</a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Returns</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>Manage return requests and refunds</p>
          </div>
          <div className="flex gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-48 focus:outline-none bg-white" style={{ color: '#111827' }} />
            <button onClick={() => setShowAdd(true)} className="text-white text-sm px-4 py-2 rounded-lg font-medium" style={{ background: '#c8973a' }}>
              + Log Return
            </button>
          </div>
        </div>

        {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">{msg}</div>}

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Returns',  value: returns.length,                                        icon: '', color: '#1a1008' },
            { label: 'Requested',      value: returns.filter(r => r.status === 'requested').length,  icon: '', color: '#f59e0b' },
            { label: 'Approved',       value: returns.filter(r => r.status === 'approved').length,   icon: '', color: '#10b981' },
            { label: 'Refund Amount',  value: 'Rs ' + returns.filter(r => r.status === 'approved').reduce((s,r) => s+(r.refund_amount||0),0), icon: '', color: '#ef4444' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>{loading ? '...' : card.value}</div>
              <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Order','Customer','Reason','Refund','Status','Date','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#1a1008' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No returns yet</td></tr>
              ) : filtered.map(ret => {
                const sc = statusColors[ret.status] || statusColors.requested
                return (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c8973a' }}>{ret.order_ref}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#111827' }}>{ret.customer_name}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>{ret.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>{ret.reason}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#ef4444' }}>{ret.refund_amount > 0 ? 'Rs ' + ret.refund_amount : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ background: sc.bg, color: sc.color }}>{ret.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#2a1f1a' }}>{new Date(ret.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelected(ret)} className="text-xs px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#1a1008' }}>View</button>
                        {ret.status === 'requested' && (
                          <>
                            <button onClick={() => updateReturnStatus(ret.id, 'approved')} className="text-xs px-2 py-1 rounded font-medium" style={{ background: '#dcfce7', color: '#166534' }}>Approve</button>
                            <button onClick={() => updateReturnStatus(ret.id, 'rejected')} className="text-xs px-2 py-1 rounded font-medium" style={{ background: '#fef2f2', color: '#ef4444' }}>Reject</button>
                          </>
                        )}
                        {ret.status === 'approved' && (
                          <button onClick={() => updateReturnStatus(ret.id, 'completed')} className="text-xs px-2 py-1 rounded font-medium" style={{ background: '#dbeafe', color: '#1e40af' }}>Complete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Log Return Request</div>
              <button onClick={() => setShowAdd(false)} className="text-2xl font-light" style={{ color: '#2a1f1a' }}>x</button>
            </div>
            <div className="p-6 space-y-3">
              {[{ label: 'Order Ref *', key: 'order_ref', placeholder: 'GOB-ABC123' }, { label: 'Refund Amount', key: 'refund_amount', placeholder: '0' }, { label: 'Notes', key: 'notes', placeholder: 'Notes...' }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>{f.label}</label>
                  <input value={(newReturn as any)[f.key]} onChange={e => setNewReturn({ ...newReturn, [f.key]: e.target.value })}
                    placeholder={f.placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: '#111827' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Reason *</label>
                <select value={newReturn.reason} onChange={e => setNewReturn({ ...newReturn, reason: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: '#111827' }}>
                  <option value="">Select reason...</option>
                  <option value="Wrong product delivered">Wrong product delivered</option>
                  <option value="Damaged product">Damaged product</option>
                  <option value="Quality issue">Quality issue</option>
                  <option value="Customer refused delivery">Customer refused delivery</option>
                  <option value="Not delivered">Not delivered</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: '#f3f4f6', color: '#1a1008' }}>Cancel</button>
                <button onClick={addReturn} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Log Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-mono font-bold text-lg" style={{ color: '#c8973a' }}>{selected.order_ref}</div>
              <button onClick={() => setSelected(null)} className="text-2xl font-light" style={{ color: '#2a1f1a' }}>x</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs font-semibold uppercase mb-1" style={{ color: '#1a1008' }}>Reason</div><div className="text-sm" style={{ color: '#1a1008' }}>{selected.reason}</div></div>
                <div><div className="text-xs font-semibold uppercase mb-1" style={{ color: '#1a1008' }}>Refund</div><div className="text-sm font-bold" style={{ color: '#ef4444' }}>{selected.refund_amount > 0 ? 'Rs ' + selected.refund_amount : 'Not set'}</div></div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#1a1008' }}>Update Status</div>
                <div className="flex gap-2 flex-wrap">
                  {['requested','approved','rejected','completed'].map(s => (
                    <button key={s} onClick={() => updateReturnStatus(selected.id, s)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
                      style={{ background: selected.status === s ? '#1a1008' : '#f3f4f6', color: selected.status === s ? 'white' : '#374151' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
