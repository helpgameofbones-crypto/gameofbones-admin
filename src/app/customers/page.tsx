'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CustomersPage() {
  const [customers, setCustomers]         = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterSegment, setFilterSegment] = useState('all')
  const [selected, setSelected]           = useState<any>(null)
  const [orders, setOrders]               = useState<any[]>([])
  const [editNote, setEditNote]           = useState('')
  const [savingNote, setSavingNote]       = useState(false)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [saving, setSaving]               = useState(false)
  const [newCustomer, setNewCustomer]     = useState({
    name: '', phone: '', email: '',
    address_line1: '', city: '', state: '', pincode: ''
  })

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('total_spent', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function fetchCustomerOrders(phone: string) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  async function saveNote(customerId: string) {
    setSavingNote(true)
    await supabase.from('customers').update({ notes: editNote }).eq('id', customerId)
    setSavingNote(false)
    setSelected({ ...selected, notes: editNote })
    fetchCustomers()
  }

  async function toggleBlacklist(customerId: string, current: boolean) {
    await supabase.from('customers').update({ is_blacklisted: !current }).eq('id', customerId)
    fetchCustomers()
    if (selected?.id === customerId) setSelected({ ...selected, is_blacklisted: !current })
  }

  async function addCustomer() {
    if (!newCustomer.name || !newCustomer.phone) return
    setSaving(true)
    await supabase.from('customers').insert({
      name:          newCustomer.name,
      phone:         newCustomer.phone,
      email:         newCustomer.email,
      address_line1: newCustomer.address_line1,
      city:          newCustomer.city,
      state:         newCustomer.state,
      pincode:       newCustomer.pincode,
      total_orders:  0,
      total_spent:   0,
    })
    setSaving(false)
    setShowAddModal(false)
    setNewCustomer({ name: '', phone: '', email: '', address_line1: '', city: '', state: '', pincode: '' })
    fetchCustomers()
  }

  function exportCSV() {
    const rows = [
      ['Name','Phone','Email','City','State','Total Orders','Total Spent','Segment','Joined'],
      ...filtered.map(c => [
        c.name, c.phone, c.email || '',
        c.city || '', c.state || '',
        c.total_orders, c.total_spent,
        getSegment(c),
        new Date(c.created_at).toLocaleDateString('en-IN')
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'customers.csv'
    a.click()
  }

  function getSegment(c: any) {
    if (c.is_blacklisted)    return 'Blacklisted'
    if (c.total_spent >= 5000) return 'VIP'
    if (c.total_orders > 3)  return 'Loyal'
    if (c.total_orders > 1)  return 'Repeat'
    if (c.total_orders === 1) return 'New'
    return 'Inactive'
  }

  function getSegmentStyle(segment: string) {
    const styles: Record<string, { bg: string; color: string }> = {
      VIP:         { bg: '#fef3c7', color: '#92400e' },
      Loyal:       { bg: '#dcfce7', color: '#166534' },
      Repeat:      { bg: '#dbeafe', color: '#1e40af' },
      New:         { bg: '#f3f4f6', color: '#1a1008' },
      Inactive:    { bg: '#f9fafb', color: '#2a1f1a' },
      Blacklisted: { bg: '#fef2f2', color: '#ef4444' },
    }
    return styles[segment] || styles.Inactive
  }

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const seg = getSegment(c)
    const matchSegment =
      filterSegment === 'all'         ? true :
      filterSegment === 'vip'         ? seg === 'VIP' :
      filterSegment === 'loyal'       ? seg === 'Loyal' :
      filterSegment === 'repeat'      ? seg === 'Repeat' :
      filterSegment === 'new'         ? seg === 'New' :
      filterSegment === 'inactive'    ? seg === 'Inactive' :
      filterSegment === 'blacklisted' ? seg === 'Blacklisted' : true
    return matchSearch && matchSegment
  })

  const vipCount       = customers.filter(c => c.total_spent >= 5000).length
  const repeatCount    = customers.filter(c => c.total_orders > 1).length
  const blacklistCount = customers.filter(c => c.is_blacklisted).length

  const navLinks = [
    { label: 'Dashboard',  href: '/dashboard' },
    { label: 'Orders',     href: '/orders' },
    { label: 'Products',   href: '/products' },
    { label: 'Customers',  href: '/customers' },
    { label: 'Coupons',    href: '/coupons' },
    { label: 'Banners',    href: '/banners' },
    { label: 'Analytics',  href: '/analytics' },
    { label: 'Inventory',  href: '/inventory' },
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Customers</h1>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none bg-white"
              style={{ color: '#111827' }}
            />
            <button onClick={() => setShowAddModal(true)}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: '#c8973a' }}>
              + Add Customer
            </button>
            <button onClick={exportCSV}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: '#1a1008' }}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Customers', value: customers.length, icon: 'ðŸ‘¤', color: '#8b5cf6' },
            { label: 'VIP (â‚¹5000+)',    value: vipCount,         icon: 'â­', color: '#f59e0b' },
            { label: 'Repeat Buyers',   value: repeatCount,      icon: 'ðŸ”„', color: '#10b981' },
            { label: 'Blacklisted',     value: blacklistCount,   icon: 'ðŸš«', color: '#ef4444' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs" style={{ color: '#1a1008', marginTop: 2 }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'all',         label: 'All' },
            { key: 'vip',         label: 'â­ VIP' },
            { key: 'loyal',       label: 'Loyal (4+ orders)' },
            { key: 'repeat',      label: 'Repeat' },
            { key: 'new',         label: 'New' },
            { key: 'inactive',    label: 'Inactive' },
            { key: 'blacklisted', label: 'ðŸš« Blacklisted' },
          ].map(seg => (
            <button key={seg.key} onClick={() => setFilterSegment(seg.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: filterSegment === seg.key ? '#1a1008' : 'white',
                color: filterSegment === seg.key ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {seg.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer','Phone','Location','Orders','Total Spent','Segment','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>No customers found</td></tr>
              ) : filtered.map(customer => {
                const segment  = getSegment(customer)
                const segStyle = getSegmentStyle(segment)
                return (
                  <tr key={customer.id} className="hover:bg-gray-50"
                    style={{ background: customer.is_blacklisted ? '#fef2f2' : 'white' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#111827' }}>{customer.name}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>{customer.email}</div>
                      {customer.notes && (
                        <div className="text-xs mt-0.5 italic" style={{ color: '#c8973a' }}>
                          ðŸ“ {customer.notes.slice(0, 40)}{customer.notes.length > 40 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#1a1008' }}>{customer.phone}</td>
                    <td className="px-4 py-3">
                      <div style={{ color: '#1a1008' }}>{customer.city}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>{customer.state}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-center" style={{ color: '#1a1008' }}>
                      {customer.total_orders}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#10b981' }}>
                      â‚¹{customer.total_spent?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: segStyle.bg, color: segStyle.color }}>
                        {segment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelected(customer)
                          setEditNote(customer.notes || '')
                          fetchCustomerOrders(customer.phone)
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: '#f3f4f6', color: '#1a1008' }}>
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Add New Customer</div>
              <button onClick={() => setShowAddModal(false)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}>âœ•</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Full Name *',  key: 'name',          placeholder: 'Rahul Sharma' },
                { label: 'Phone *',      key: 'phone',         placeholder: '9876543210' },
                { label: 'Email',        key: 'email',         placeholder: 'rahul@email.com' },
                { label: 'Address',      key: 'address_line1', placeholder: 'Street address' },
                { label: 'City',         key: 'city',          placeholder: 'Mumbai' },
                { label: 'State',        key: 'state',         placeholder: 'Maharashtra' },
                { label: 'Pincode',      key: 'pincode',       placeholder: '400001' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                    {field.label}
                  </label>
                  <input
                    value={newCustomer[field.key as keyof typeof newCustomer]}
                    onChange={e => setNewCustomer({ ...newCustomer, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#1a1008' }}>
                  Cancel
                </button>
                <button onClick={addCustomer} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-bold text-lg" style={{ color: '#111827' }}>{selected.name}</div>
                <div className="text-sm" style={{ color: '#2a1f1a' }}>{selected.phone} Â· {selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}>âœ•</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: '#1a1008' }}>{selected.total_orders}</div>
                  <div className="text-xs" style={{ color: '#1a1008' }}>Total Orders</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: '#10b981' }}>
                    â‚¹{selected.total_spent?.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs" style={{ color: '#1a1008' }}>Total Spent</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#1a1008' }}>Address</div>
                <div className="text-sm" style={{ color: '#1a1008', lineHeight: 1.7 }}>
                  {selected.address_line1}<br />
                  {selected.city}, {selected.state} â€” {selected.pincode}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#1a1008' }}>Internal Notes</div>
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="Add private notes about this customer..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ color: '#111827' }}
                />
                <button onClick={() => saveNote(selected.id)}
                  disabled={savingNote}
                  className="mt-2 text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: selected.is_blacklisted ? '#fef2f2' : '#f9fafb' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#111827' }}>
                    {selected.is_blacklisted ? 'ðŸš« Customer is Blacklisted' : 'Blacklist Customer'}
                  </div>
                  <div className="text-xs" style={{ color: '#1a1008' }}>
                    {selected.is_blacklisted
                      ? 'COD orders blocked for this customer'
                      : 'Block this customer from COD orders'}
                  </div>
                </div>
                <button
                  onClick={() => toggleBlacklist(selected.id, selected.is_blacklisted)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                  style={{ background: selected.is_blacklisted ? '#10b981' : '#ef4444' }}>
                  {selected.is_blacklisted ? 'Remove' : 'Blacklist'}
                </button>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>Order History</div>
                {orders.length === 0 ? (
                  <div className="text-sm" style={{ color: '#2a1f1a' }}>No orders found</div>
                ) : orders.map(order => (
                  <div key={order.id} className="border border-gray-100 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono font-bold text-sm" style={{ color: '#c8973a' }}>{order.ref}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#2a1f1a' }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </div>
                        <div className="text-xs mt-1" style={{ color: '#1a1008' }}>
                          {(order.items || []).map((i: any) => `${i.qty}Ã— ${i.name}`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm" style={{ color: '#111827' }}>
                          â‚¹{order.grand_total?.toLocaleString('en-IN')}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                          style={{
                            background: order.status === 'delivered' ? '#dcfce7' :
                              order.status === 'rto' ? '#fef2f2' : '#dbeafe',
                            color: order.status === 'delivered' ? '#166534' :
                              order.status === 'rto' ? '#ef4444' : '#1e40af'
                          }}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
