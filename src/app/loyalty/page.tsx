'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoyaltyPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<any>(null)
  const [dogProfile, setDogProfile] = useState({
    dog_name: '', dog_breed: '', dog_age: '', dog_weight: '', dog_preferences: ''
  })
  const [savingDog, setSavingDog] = useState(false)
  const [addingPoints, setAddingPoints] = useState(false)
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [search, setSearch]       = useState('')

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('loyalty_points', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function saveDogProfile() {
    if (!selected) return
    setSavingDog(true)
    await supabase.from('customers').update({
      dog_name:         dogProfile.dog_name,
      dog_breed:        dogProfile.dog_breed,
      dog_age:          dogProfile.dog_age,
      dog_weight:       dogProfile.dog_weight,
      dog_preferences:  dogProfile.dog_preferences,
    }).eq('id', selected.id)
    setSavingDog(false)
    setSelected({ ...selected, ...dogProfile })
    fetchCustomers()
  }

  async function addPoints() {
    if (!selected || !pointsAmount) return
    setAddingPoints(true)
    const newPoints = (selected.loyalty_points || 0) + parseInt(pointsAmount)
    await supabase.from('customers')
      .update({ loyalty_points: newPoints })
      .eq('id', selected.id)
    await supabase.from('activity_log').insert({
      action:      'loyalty points added',
      entity_type: 'customer',
      entity_id:   selected.id,
      entity_name: selected.name,
      details:     `+${pointsAmount} points â€” ${pointsReason}`,
    })
    setSelected({ ...selected, loyalty_points: newPoints })
    setAddingPoints(false)
    setPointsAmount('')
    setPointsReason('')
    fetchCustomers()
  }

  async function generateReferralCode(customerId: string, phone: string) {
    const code = 'GOB' + phone.slice(-4) + Math.random().toString(36).slice(-3).toUpperCase()
    await supabase.from('customers').update({ referral_code: code }).eq('id', customerId)
    setSelected({ ...selected, referral_code: code })
    fetchCustomers()
  }

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.dog_name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPointsIssued = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0)
  const customersWithDogs = customers.filter(c => c.dog_name).length
  const customersWithReferral = customers.filter(c => c.referral_code).length

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Customers', href: '/customers' },
    { label: 'Loyalty',   href: '/loyalty' },
    { label: 'Finance',   href: '/finance' },
    { label: 'Analytics', href: '/analytics' },
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
              Loyalty & Dog Profiles
            </h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Manage loyalty points, dog profiles and referral codes
            </p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or dog name..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Points Issued',    value: totalPointsIssued.toLocaleString('en-IN'), icon: 'â­', color: '#f59e0b' },
            { label: 'Dog Profiles Filled',    value: customersWithDogs,                          icon: 'ðŸ•', color: '#10b981' },
            { label: 'Referral Codes Active',  value: customersWithReferral,                      icon: 'ðŸ”—', color: '#8b5cf6' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer','Dog','Breed/Age','Points','Referral Code','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No customers found</td></tr>
              ) : filtered.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{customer.name}</div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>{customer.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {customer.dog_name ? (
                      <div className="font-medium" style={{ color: '#c8973a' }}>ðŸ• {customer.dog_name}</div>
                    ) : (
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>Not filled</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                    {customer.dog_breed && <div>{customer.dog_breed}</div>}
                    {customer.dog_age && <div>{customer.dog_age}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: '#f59e0b' }}>
                      â­ {customer.loyalty_points || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {customer.referral_code ? (
                      <span className="font-mono text-xs px-2 py-1 rounded"
                        style={{ background: '#f3f4f6', color: '#1a1008' }}>
                        {customer.referral_code}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#2a1f1a' }}>None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelected(customer)
                        setDogProfile({
                          dog_name:        customer.dog_name || '',
                          dog_breed:       customer.dog_breed || '',
                          dog_age:         customer.dog_age || '',
                          dog_weight:      customer.dog_weight || '',
                          dog_preferences: customer.dog_preferences || '',
                        })
                      }}
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

      {/* Customer loyalty modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-bold text-lg" style={{ color: '#111827' }}>{selected.name}</div>
                <div className="text-sm" style={{ color: '#2a1f1a' }}>{selected.phone}</div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}>âœ•</button>
            </div>

            <div className="p-6 space-y-6">

              {/* Loyalty Points */}
              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>
                  Loyalty Points
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 mb-3 text-center">
                  <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
                    â­ {selected.loyalty_points || 0}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#92400e' }}>points balance</div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={pointsAmount}
                    onChange={e => setPointsAmount(e.target.value)}
                    placeholder="Points to add..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  <input
                    value={pointsReason}
                    onChange={e => setPointsReason(e.target.value)}
                    placeholder="Reason..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                  <button onClick={addPoints} disabled={addingPoints}
                    className="text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: '#f59e0b' }}>
                    {addingPoints ? '...' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Dog Profile */}
              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>
                  Dog Profile
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Dog Name',    key: 'dog_name',        placeholder: 'Bruno' },
                    { label: 'Breed',       key: 'dog_breed',       placeholder: 'Labrador' },
                    { label: 'Age',         key: 'dog_age',         placeholder: '2 years' },
                    { label: 'Weight',      key: 'dog_weight',      placeholder: '25 kg' },
                    { label: 'Preferences', key: 'dog_preferences', placeholder: 'Loves fish, allergic to chicken' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: '#1a1008' }}>
                        {field.label}
                      </label>
                      <input
                        value={dogProfile[field.key as keyof typeof dogProfile]}
                        onChange={e => setDogProfile({ ...dogProfile, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ color: '#111827' }}
                      />
                    </div>
                  ))}
                  <button onClick={saveDogProfile} disabled={savingDog}
                    className="w-full py-2 rounded-lg font-medium text-white disabled:opacity-50"
                    style={{ background: '#1a1008' }}>
                    {savingDog ? 'Saving...' : 'Save Dog Profile'}
                  </button>
                </div>
              </div>

              {/* Referral Code */}
              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>
                  Referral Code
                </div>
                {selected.referral_code ? (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="font-mono font-bold text-xl" style={{ color: '#1a1008' }}>
                      {selected.referral_code}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#2a1f1a' }}>
                      Share this code with friends for rewards
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => generateReferralCode(selected.id, selected.phone)}
                    className="w-full py-2 rounded-lg font-medium text-white"
                    style={{ background: '#8b5cf6' }}>
                    ðŸ”— Generate Referral Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
