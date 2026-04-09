'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OperationsPage() {
  const [tab, setTab]                     = useState('suppliers')
  const [suppliers, setSuppliers]         = useState<any[]>([])
  const [packaging, setPackaging]         = useState<any[]>([])
  const [staff, setStaff]                 = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [showAddPackaging, setShowAddPackaging] = useState(false)
  const [showAddStaff, setShowAddStaff]   = useState(false)
  const [saving, setSaving]               = useState(false)

  const [newSupplier, setNewSupplier] = useState({
    name: '', contact_name: '', phone: '', email: '',
    address: '', products_supplied: '', lead_time_days: '', moq: '', price_notes: ''
  })

  const [newPackaging, setNewPackaging] = useState({
    name: '', unit: 'pieces', current_stock: '', min_stock: '', cost_per_unit: '', supplier: '', notes: ''
  })

  const [newStaff, setNewStaff] = useState({
    name: '', email: '', role: 'staff'
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [s, p, st] = await Promise.all([
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('packaging_materials').select('*').order('name'),
      supabase.from('staff_accounts').select('*').order('name'),
    ])
    setSuppliers(s.data || [])
    setPackaging(p.data || [])
    setStaff(st.data || [])
    setLoading(false)
  }

  async function addSupplier() {
    if (!newSupplier.name) return
    setSaving(true)
    await supabase.from('suppliers').insert({
      ...newSupplier,
      lead_time_days: parseInt(newSupplier.lead_time_days) || 0
    })
    setSaving(false)
    setShowAddSupplier(false)
    setNewSupplier({ name:'',contact_name:'',phone:'',email:'',address:'',products_supplied:'',lead_time_days:'',moq:'',price_notes:'' })
    fetchAll()
  }

  async function addPackaging() {
    if (!newPackaging.name) return
    setSaving(true)
    await supabase.from('packaging_materials').insert({
      ...newPackaging,
      current_stock: parseInt(newPackaging.current_stock) || 0,
      min_stock:     parseInt(newPackaging.min_stock) || 20,
      cost_per_unit: parseFloat(newPackaging.cost_per_unit) || 0,
    })
    setSaving(false)
    setShowAddPackaging(false)
    setNewPackaging({ name:'',unit:'pieces',current_stock:'',min_stock:'',cost_per_unit:'',supplier:'',notes:'' })
    fetchAll()
  }

  async function addStaff() {
    if (!newStaff.name || !newStaff.email) return
    setSaving(true)
    await supabase.from('staff_accounts').insert(newStaff)
    setSaving(false)
    setShowAddStaff(false)
    setNewStaff({ name:'', email:'', role:'staff' })
    fetchAll()
  }

  async function updatePackagingStock(id: string, stock: number) {
    await supabase.from('packaging_materials')
      .update({ current_stock: stock, updated_at: new Date().toISOString() })
      .eq('id', id)
    fetchAll()
  }

  async function deleteSupplier(id: string) {
    await supabase.from('suppliers').update({ is_active: false }).eq('id', id)
    fetchAll()
  }

  const lowPackaging = packaging.filter(p => p.current_stock <= p.min_stock)

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'Orders',      href: '/orders' },
    { label: 'Products',    href: '/products' },
    { label: 'Operations',  href: '/operations' },
    { label: 'Finance',     href: '/finance' },
    { label: 'Analytics',   href: '/analytics' },
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Operations</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Suppliers, packaging materials, and staff accounts
          </p>
        </div>

        {lowPackaging.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="font-medium text-sm mb-1" style={{ color: '#92400e' }}>
              âš ï¸ {lowPackaging.length} packaging material{lowPackaging.length > 1 ? 's' : ''} running low
            </div>
            <div className="text-xs" style={{ color: '#92400e' }}>
              {lowPackaging.map(p => p.name).join(', ')}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['suppliers', 'packaging', 'staff'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? '#1a1008' : 'white',
                color: tab === t ? 'white' : '#6b7280',
                border: '1px solid #e5e7eb'
              }}>
              {t === 'suppliers' ? 'ðŸ­ Suppliers' : t === 'packaging' ? 'ðŸ“¦ Packaging' : 'ðŸ‘¥ Staff'}
            </button>
          ))}
        </div>

        {/* â”€â”€ SUPPLIERS â”€â”€ */}
        {tab === 'suppliers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm" style={{ color: '#6b7280' }}>
                {suppliers.length} active suppliers
              </div>
              <button onClick={() => setShowAddSupplier(true)}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                style={{ background: '#c8973a' }}>
                + Add Supplier
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div style={{ color: '#9ca3af' }}>Loading...</div>
              ) : suppliers.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center col-span-2" style={{ color: '#9ca3af' }}>
                  No suppliers yet. Add your first supplier.
                </div>
              ) : suppliers.map(supplier => (
                <div key={supplier.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold" style={{ color: '#111827' }}>{supplier.name}</div>
                      {supplier.contact_name && (
                        <div className="text-sm" style={{ color: '#6b7280' }}>{supplier.contact_name}</div>
                      )}
                    </div>
                    <button onClick={() => deleteSupplier(supplier.id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: '#fef2f2', color: '#ef4444' }}>
                      Remove
                    </button>
                  </div>
                  <div className="space-y-1 text-xs" style={{ color: '#6b7280' }}>
                    {supplier.phone && <div>ðŸ“ž {supplier.phone}</div>}
                    {supplier.email && <div>âœ‰ï¸ {supplier.email}</div>}
                    {supplier.products_supplied && <div>ðŸ¦´ {supplier.products_supplied}</div>}
                    {supplier.lead_time_days > 0 && <div>â±ï¸ {supplier.lead_time_days} days lead time</div>}
                    {supplier.moq && <div>ðŸ“¦ MOQ: {supplier.moq}</div>}
                    {supplier.price_notes && (
                      <div className="mt-2 p-2 rounded" style={{ background: '#f9f6f2' }}>
                        ðŸ’° {supplier.price_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* â”€â”€ PACKAGING â”€â”€ */}
        {tab === 'packaging' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm" style={{ color: '#6b7280' }}>
                {packaging.length} materials tracked
              </div>
              <button onClick={() => setShowAddPackaging(true)}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                style={{ background: '#c8973a' }}>
                + Add Material
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Material','Unit','Stock','Min Stock','Cost/Unit','Status','Update Stock'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
                  ) : packaging.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No packaging materials yet</td></tr>
                  ) : packaging.map(item => {
                    const isLow = item.current_stock <= item.min_stock
                    return (
                      <tr key={item.id} className="hover:bg-gray-50"
                        style={{ background: isLow ? '#fefce8' : 'white' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#111827' }}>{item.name}</div>
                          {item.supplier && <div className="text-xs" style={{ color: '#9ca3af' }}>{item.supplier}</div>}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#6b7280' }}>{item.unit}</td>
                        <td className="px-4 py-3 font-bold text-xl"
                          style={{ color: isLow ? '#f59e0b' : '#10b981' }}>
                          {item.current_stock}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#6b7280' }}>{item.min_stock}</td>
                        <td className="px-4 py-3" style={{ color: '#374151' }}>
                          {item.cost_per_unit ? 'â‚¹' + item.cost_per_unit : 'â€”'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              background: isLow ? '#fef3c7' : '#f0fdf4',
                              color: isLow ? '#92400e' : '#15803d'
                            }}>
                            {isLow ? 'âš ï¸ Low' : 'âœ… OK'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            defaultValue={item.current_stock}
                            onBlur={e => {
                              const val = parseInt(e.target.value)
                              if (!isNaN(val) && val !== item.current_stock) {
                                updatePackagingStock(item.id, val)
                              }
                            }}
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                            style={{ color: '#111827' }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* â”€â”€ STAFF â”€â”€ */}
        {tab === 'staff' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm" style={{ color: '#6b7280' }}>
                {staff.length} staff accounts
              </div>
              <button onClick={() => setShowAddStaff(true)}
                className="text-white text-sm px-4 py-2 rounded-lg font-medium"
                style={{ background: '#c8973a' }}>
                + Add Staff
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Name','Email','Role','Status','Last Login'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
                  ) : staff.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>No staff accounts yet</td></tr>
                  ) : staff.map(member => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{member.name}</td>
                      <td className="px-4 py-3" style={{ color: '#6b7280' }}>{member.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full capitalize"
                          style={{ background: '#dbeafe', color: '#1e40af' }}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: member.is_active ? '#dcfce7' : '#f3f4f6',
                            color: member.is_active ? '#166534' : '#6b7280'
                          }}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>
                        {member.last_login
                          ? new Date(member.last_login).toLocaleDateString('en-IN')
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Add Supplier</div>
              <button onClick={() => setShowAddSupplier(false)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>âœ•</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Supplier Name *', key: 'name',               placeholder: 'Fresh Farms Ltd' },
                { label: 'Contact Person',  key: 'contact_name',       placeholder: 'Rajesh Kumar' },
                { label: 'Phone',           key: 'phone',              placeholder: '9876543210' },
                { label: 'Email',           key: 'email',              placeholder: 'supplier@email.com' },
                { label: 'Address',         key: 'address',            placeholder: 'Full address' },
                { label: 'Products Supplied', key: 'products_supplied', placeholder: 'Chicken, Goat organs' },
                { label: 'Lead Time (days)', key: 'lead_time_days',    placeholder: '3' },
                { label: 'MOQ',             key: 'moq',                placeholder: '5 kg minimum' },
                { label: 'Price Notes',     key: 'price_notes',        placeholder: 'Chicken â‚¹180/kg, Goat â‚¹350/kg' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    {field.label}
                  </label>
                  <input
                    value={newSupplier[field.key as keyof typeof newSupplier]}
                    onChange={e => setNewSupplier({ ...newSupplier, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddSupplier(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={addSupplier} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Packaging Modal */}
      {showAddPackaging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Add Packaging Material</div>
              <button onClick={() => setShowAddPackaging(false)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>âœ•</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Material Name *', key: 'name',          placeholder: 'Brown Boxes (Small)' },
                { label: 'Unit',            key: 'unit',          placeholder: 'pieces' },
                { label: 'Current Stock',   key: 'current_stock', placeholder: '100' },
                { label: 'Min Stock Alert', key: 'min_stock',     placeholder: '20' },
                { label: 'Cost per Unit',   key: 'cost_per_unit', placeholder: '5' },
                { label: 'Supplier',        key: 'supplier',      placeholder: 'Amazon / local vendor' },
                { label: 'Notes',           key: 'notes',         placeholder: 'Any notes...' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    {field.label}
                  </label>
                  <input
                    value={newPackaging[field.key as keyof typeof newPackaging]}
                    onChange={e => setNewPackaging({ ...newPackaging, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddPackaging(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={addPackaging} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Add Material'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Add Staff Account</div>
              <button onClick={() => setShowAddStaff(false)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>âœ•</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Full Name *', key: 'name',  placeholder: 'Priya Sharma' },
                { label: 'Email *',     key: 'email', placeholder: 'priya@gameofbones.in' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                    {field.label}
                  </label>
                  <input
                    value={newStaff[field.key as keyof typeof newStaff]}
                    onChange={e => setNewStaff({ ...newStaff, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ color: '#111827' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Role</label>
                <select
                  value={newStaff.role}
                  onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}>
                  <option value="staff">Staff (pack orders)</option>
                  <option value="manager">Manager (full access)</option>
                  <option value="readonly">Read only</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddStaff(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={addStaff} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1a1008' }}>
                  {saving ? 'Saving...' : 'Add Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
