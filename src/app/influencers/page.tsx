'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EMPTY_FORM = {
  name: '', instagram_handle: '', phone: '', email: '', address: '',
  collab_type: 'barter', payment_amount: '', notes: '',
}

const EMPTY_SEND = { items: '', value: '', sent_date: new Date().toISOString().split('T')[0], tracking_awb: '', notes: '' }

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<any[]>([])
  const [sends, setSends]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('all')
  const [selected, setSelected]       = useState<any>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [sendForm, setSendForm]       = useState(EMPTY_SEND)
  const [saving, setSaving]           = useState(false)
  const [loggingSend, setLoggingSend] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [inf, snd] = await Promise.all([
      supabase.from('influencers').select('*').order('created_at', { ascending: false }),
      supabase.from('influencer_sends').select('*').order('sent_date', { ascending: false }),
    ])
    setInfluencers(inf.data || [])
    setSends(snd.data || [])
    setLoading(false)
  }

  function sendsFor(influencerId: string) {
    return sends.filter(s => s.influencer_id === influencerId)
  }

  async function saveInfluencer() {
    if (!form.name || !form.instagram_handle) return
    setSaving(true)
    await supabase.from('influencers').insert({
      name:              form.name,
      instagram_handle:  form.instagram_handle.replace(/^@/, ''),
      phone:             form.phone,
      email:             form.email,
      address:           form.address,
      collab_type:       form.collab_type,
      payment_amount:    form.collab_type === 'paid' && form.payment_amount ? parseFloat(form.payment_amount) : null,
      notes:             form.notes,
    })
    setSaving(false)
    setShowAddForm(false)
    setForm(EMPTY_FORM)
    fetchAll()
  }

  async function logSend() {
    if (!selected || !sendForm.items) return
    setLoggingSend(true)
    await supabase.from('influencer_sends').insert({
      influencer_id: selected.id,
      items:         sendForm.items,
      value:         sendForm.value ? parseFloat(sendForm.value) : null,
      sent_date:     sendForm.sent_date,
      tracking_awb:  sendForm.tracking_awb,
      notes:         sendForm.notes,
    })
    await supabase.from('activity_log').insert({
      action:      'influencer send logged',
      entity_type: 'influencer',
      entity_id:   selected.id,
      entity_name: selected.name,
      details:     `Sent: ${sendForm.items}${sendForm.value ? ` (₹${sendForm.value})` : ''}`,
    })
    setLoggingSend(false)
    setSendForm(EMPTY_SEND)
    fetchAll()
  }

  async function deleteInfluencer(id: string) {
    if (!confirm('Delete this influencer and their send history?')) return
    await supabase.from('influencer_sends').delete().eq('influencer_id', id)
    await supabase.from('influencers').delete().eq('id', id)
    setSelected(null)
    fetchAll()
  }

  const filtered = influencers.filter(i => {
    const matchesSearch = !search ||
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.instagram_handle?.toLowerCase().includes(search.toLowerCase()) ||
      i.phone?.includes(search)
    const matchesType = filterType === 'all' || i.collab_type === filterType
    return matchesSearch && matchesType
  })

  const totalBarter = influencers.filter(i => i.collab_type === 'barter').length
  const totalPaid   = influencers.filter(i => i.collab_type === 'paid').length
  const totalValueSent = sends.reduce((s, snd) => s + (snd.value || 0), 0)

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Influencers</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Track influencer collabs — barter vs paid, contact details, and what's been sent
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, Instagram, or phone..."
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none bg-white"
              style={{ color: '#111827' }}
            />
            <button onClick={() => setShowAddForm(true)}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: '#1a1008' }}>
              + Add Influencer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Influencers', value: influencers.length,                              color: '#1a1008' },
            { label: 'Barter Collabs',    value: totalBarter,                                      color: '#8b5cf6' },
            { label: 'Paid Collabs',      value: totalPaid,                                        color: '#16a34a' },
            { label: 'Total Value Sent',  value: '₹' + totalValueSent.toLocaleString('en-IN'),      color: '#f59e0b' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { key: 'all',    label: 'All' },
            { key: 'barter', label: 'Barter' },
            { key: 'paid',   label: 'Paid' },
          ].map(t => (
            <button key={t.key} onClick={() => setFilterType(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: filterType === t.key ? '#1a1008' : 'white',
                color: filterType === t.key ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Influencer', 'Instagram', 'Contact', 'Type', 'Times Sent', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No influencers found</td></tr>
              ) : filtered.map(inf => (
                <tr key={inf.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{inf.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`https://instagram.com/${inf.instagram_handle}`} target="_blank" rel="noreferrer"
                      className="text-xs font-mono" style={{ color: '#c026d3' }}>
                      @{inf.instagram_handle}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                    {inf.phone && <div>{inf.phone}</div>}
                    {inf.email && <div style={{ color: '#2a1f1a' }}>{inf.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: inf.collab_type === 'paid' ? '#dcfce7' : '#f3e8ff',
                        color: inf.collab_type === 'paid' ? '#166534' : '#7e22ce'
                      }}>
                      {inf.collab_type === 'paid' ? `Paid${inf.payment_amount ? ' · ₹' + inf.payment_amount : ''}` : 'Barter'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: '#1a1008' }}>
                    {sendsFor(inf.id).length}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(inf)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: '#f3f4f6', color: '#1a1008' }}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Add Influencer</div>
              <button onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}>&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Name',              key: 'name',             placeholder: 'Full name' },
                { label: 'Instagram Handle',  key: 'instagram_handle', placeholder: 'handle (without @)' },
                { label: 'Phone',             key: 'phone',            placeholder: '98765 43210' },
                { label: 'Email',             key: 'email',            placeholder: 'name@example.com' },
                { label: 'Address',           key: 'address',          placeholder: 'Shipping address' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#1a1008' }}>{field.label}</label>
                  <input
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#1a1008' }}>Collab Type</label>
                <div className="flex gap-2">
                  {['barter', 'paid'].map(t => (
                    <button key={t} onClick={() => setForm({ ...form, collab_type: t })}
                      className="flex-1 py-2 rounded-lg text-sm font-medium capitalize"
                      style={{
                        background: form.collab_type === t ? '#1a1008' : '#f3f4f6',
                        color: form.collab_type === t ? 'white' : '#1a1008'
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {form.collab_type === 'paid' && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#1a1008' }}>Payment Amount (₹)</label>
                  <input
                    type="number"
                    value={form.payment_amount}
                    onChange={e => setForm({ ...form, payment_amount: e.target.value })}
                    placeholder="5000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#1a1008' }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Deal terms, deliverables, follow-up dates..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <button onClick={saveInfluencer} disabled={saving || !form.name || !form.instagram_handle}
                className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1008' }}>
                {saving ? 'Saving...' : 'Save Influencer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-bold text-lg" style={{ color: '#111827' }}>{selected.name}</div>
                <div className="text-sm" style={{ color: '#2a1f1a' }}>@{selected.instagram_handle}</div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}>&times;</button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>Contact Details</div>
                <div className="text-sm space-y-1" style={{ color: '#1a1008' }}>
                  {selected.phone && <div>📱 {selected.phone}</div>}
                  {selected.email && <div>✉️ {selected.email}</div>}
                  {selected.address && <div>📍 {selected.address}</div>}
                  <div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium inline-block mt-1"
                      style={{
                        background: selected.collab_type === 'paid' ? '#dcfce7' : '#f3e8ff',
                        color: selected.collab_type === 'paid' ? '#166534' : '#7e22ce'
                      }}>
                      {selected.collab_type === 'paid' ? `Paid${selected.payment_amount ? ' · ₹' + selected.payment_amount : ''}` : 'Barter'}
                    </span>
                  </div>
                  {selected.notes && <div className="text-xs mt-2" style={{ color: '#2a1f1a' }}>{selected.notes}</div>}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>Log a Send</div>
                <div className="space-y-2">
                  <input
                    value={sendForm.items}
                    onChange={e => setSendForm({ ...sendForm, items: e.target.value })}
                    placeholder="What was sent (e.g. 2x Chicken Jerky 200g, 1x Tuna Bites)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={sendForm.value}
                      onChange={e => setSendForm({ ...sendForm, value: e.target.value })}
                      placeholder="Value (₹)"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                    <input
                      type="date"
                      value={sendForm.sent_date}
                      onChange={e => setSendForm({ ...sendForm, sent_date: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ color: '#111827' }}
                    />
                  </div>
                  <input
                    value={sendForm.tracking_awb}
                    onChange={e => setSendForm({ ...sendForm, tracking_awb: e.target.value })}
                    placeholder="Tracking / AWB number (optional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  <button onClick={logSend} disabled={loggingSend || !sendForm.items}
                    className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                    style={{ background: '#c8973a' }}>
                    {loggingSend ? 'Logging...' : 'Log Send'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>
                  Send History ({sendsFor(selected.id).length})
                </div>
                {sendsFor(selected.id).length === 0 ? (
                  <div className="text-xs" style={{ color: '#2a1f1a' }}>Nothing logged yet</div>
                ) : (
                  <div className="space-y-2">
                    {sendsFor(selected.id).map(snd => (
                      <div key={snd.id} className="bg-gray-50 rounded-lg p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium" style={{ color: '#111827' }}>{snd.items}</span>
                          <span style={{ color: '#2a1f1a' }}>{new Date(snd.sent_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        {snd.value && <div style={{ color: '#f59e0b' }}>₹{snd.value}</div>}
                        {snd.tracking_awb && <div style={{ color: '#2a1f1a' }}>AWB: {snd.tracking_awb}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => deleteInfluencer(selected.id)}
                className="w-full py-2 rounded-lg font-medium text-sm"
                style={{ background: '#fef2f2', color: '#dc2626' }}>
                Delete Influencer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
