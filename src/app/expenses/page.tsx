'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PERSONS = [
  { key: 'anjan',    label: 'Anjan',        color: '#3b82f6', bg: '#dbeafe', dark: '#1e40af' },
  { key: 'vatsal',   label: 'Vatsal',       color: '#10b981', bg: '#dcfce7', dark: '#166534' },
  { key: 'saraswat', label: 'Saraswat Bank', color: '#f59e0b', bg: '#fef3c7', dark: '#92400e' },
]

const CATEGORIES = [
  'Raw Materials', 'Packaging', 'Shipping', 'Marketing',
  'Salary', 'Rent', 'Utilities', 'Equipment',
  'Travel', 'Food', 'Miscellaneous'
]

export default function ExpensesPage() {
  const [expenses, setExpenses]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [range, setRange]         = useState('30')
  const [filterPerson, setFilterPerson] = useState('all')
  const [msg, setMsg]             = useState('')

  const [form, setForm] = useState({
    date:         new Date().toISOString().split('T')[0],
    description:  '',
    amount:       '',
    category:     'Miscellaneous',
    person:       'anjan',
    payment_mode: 'cash',
    notes:        '',
  })

  useEffect(() => { fetchExpenses() }, [range, filterPerson])

  async function fetchExpenses() {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - parseInt(range))

    let q = supabase
      .from('expenses')
      .select('*')
      .gte('date', from.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filterPerson !== 'all') q = q.eq('person', filterPerson)

    const { data } = await q
    setExpenses(data || [])
    setLoading(false)
  }

  async function addExpense() {
    if (!form.description || !form.amount) {
      setMsg('Please fill in description and amount')
      return
    }
    setSaving(true)
    await supabase.from('expenses').insert({
      date:         form.date,
      description:  form.description,
      amount:       parseFloat(form.amount),
      category:     form.category,
      person:       form.person,
      payment_mode: form.payment_mode,
      notes:        form.notes,
    })
    await supabase.from('activity_log').insert({
      action:      'expense added',
      entity_type: 'expense',
      entity_name: form.description,
      details:     `Rs ${form.amount} by ${form.person}`,
    })
    setSaving(false)
    setMsg('âœ… Expense added!')
    setForm({ ...form, description: '', amount: '', notes: '' })
    fetchExpenses()
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  function exportExcel() {
    const headers = ['Date','Description','Category','Amount','Person','Payment Mode','Notes']
    const rows = filtered.map(e => [
      e.date,
      e.description,
      e.category,
      e.amount,
      PERSONS.find(p => p.key === e.person)?.label || e.person,
      e.payment_mode,
      e.notes || ''
    ])

    // Add summary rows
    rows.push([])
    rows.push(['SUMMARY'])
    rows.push(['Person', 'Total Expenses'])
    PERSONS.forEach(p => {
      const total = filtered
        .filter(e => e.person === p.key)
        .reduce((s, e) => s + (e.amount || 0), 0)
      rows.push([p.label, total])
    })
    rows.push(['TOTAL', filtered.reduce((s, e) => s + (e.amount || 0), 0)])

    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${c}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filtered = expenses

  // Totals per person
  const totals = PERSONS.map(p => ({
    ...p,
    total: filtered.filter(e => e.person === p.key).reduce((s, e) => s + (e.amount || 0), 0)
  }))
  const grandTotal = filtered.reduce((s, e) => s + (e.amount || 0), 0)

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Finance',   href: '/finance' },
    { label: 'Expenses',  href: '/expenses' },
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
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Expense Tracker</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Track daily expenses by person
            </p>
          </div>
          <div className="flex gap-3">
            <select value={range} onChange={e => setRange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              style={{ color: '#111827' }}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </select>
            <button onClick={exportExcel}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              style={{ background: '#10b981' }}>
              ðŸ“Š Export Excel
            </button>
          </div>
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {totals.map(p => (
            <div key={p.key} className="bg-white rounded-xl p-5 shadow-sm border-l-4"
              style={{ borderLeftColor: p.color }}>
              <div className="text-xs font-semibold uppercase mb-1" style={{ color: p.color }}>
                {p.label}
              </div>
              <div className="text-2xl font-bold" style={{ color: '#111827' }}>
                â‚¹{p.total.toLocaleString('en-IN')}
              </div>
              <div className="text-xs mt-1" style={{ color: '#2a1f1a' }}>
                {filtered.filter(e => e.person === p.key).length} expenses
              </div>
            </div>
          ))}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4"
            style={{ borderLeftColor: '#1a1008' }}>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#1a1008' }}>
              Total
            </div>
            <div className="text-2xl font-bold" style={{ color: '#111827' }}>
              â‚¹{grandTotal.toLocaleString('en-IN')}
            </div>
            <div className="text-xs mt-1" style={{ color: '#2a1f1a' }}>
              {filtered.length} expenses
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Add expense form */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4" style={{ color: '#111827' }}>Add Expense</h3>
            <div className="space-y-3">

              {/* Person selector */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#1a1008' }}>
                  Person / Account
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PERSONS.map(p => (
                    <button key={p.key} onClick={() => setForm({ ...form, person: p.key })}
                      className="py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        background: form.person === p.key ? p.color : p.bg,
                        color: form.person === p.key ? 'white' : p.dark,
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                  Description *
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What was this expense for?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                  Amount (â‚¹) *
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Payment Mode</label>
                <select
                  value={form.payment_mode}
                  onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Notes</label>
                <input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <button onClick={addExpense} disabled={saving}
                className="w-full py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: PERSONS.find(p => p.key === form.person)?.color || '#1a1008' }}>
                {saving ? 'Adding...' : '+ Add Expense'}
              </button>
            </div>
          </div>

          {/* Expense list */}
          <div className="col-span-2">
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => setFilterPerson('all')}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: filterPerson === 'all' ? '#1a1008' : 'white',
                  color: filterPerson === 'all' ? 'white' : '#6b7280',
                  border: '1px solid #e5e7eb'
                }}>
                All
              </button>
              {PERSONS.map(p => (
                <button key={p.key} onClick={() => setFilterPerson(p.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{
                    background: filterPerson === p.key ? p.color : p.bg,
                    color: filterPerson === p.key ? 'white' : p.dark,
                    border: `1px solid ${p.color}40`
                  }}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date','Description','Category','Person','Amount','Mode',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                        style={{ color: '#1a1008' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                      No expenses yet. Add your first expense.
                    </td></tr>
                  ) : filtered.map(expense => {
                    const person = PERSONS.find(p => p.key === expense.person)
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50"
                        style={{ borderLeft: `3px solid ${person?.color || '#e5e7eb'}` }}>
                        <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                          {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#111827' }}>{expense.description}</div>
                          {expense.notes && (
                            <div className="text-xs" style={{ color: '#2a1f1a' }}>{expense.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#f3f4f6', color: '#1a1008' }}>
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: person?.bg, color: person?.dark }}>
                            {person?.label || expense.person}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#ef4444' }}>
                          â‚¹{expense.amount?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-xs capitalize" style={{ color: '#1a1008' }}>
                          {expense.payment_mode?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteExpense(expense.id)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: '#fef2f2', color: '#ef4444' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Footer totals */}
              {filtered.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: '#1a1008' }}>
                    {filtered.length} expenses
                  </span>
                  <span className="font-bold text-lg" style={{ color: '#ef4444' }}>
                    Total: â‚¹{grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {/* Category breakdown */}
            {filtered.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mt-4">
                <h3 className="font-bold mb-3" style={{ color: '#111827' }}>By Category</h3>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter(cat => filtered.some(e => e.category === cat)).map(cat => {
                    const total = filtered.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0)
                    const pct = Math.round((total / grandTotal) * 100)
                    return (
                      <div key={cat} className="flex justify-between items-center p-2 rounded-lg"
                        style={{ background: '#f9fafb' }}>
                        <span className="text-xs" style={{ color: '#1a1008' }}>{cat}</span>
                        <div className="text-right">
                          <span className="text-xs font-bold" style={{ color: '#111827' }}>
                            â‚¹{total.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs ml-1" style={{ color: '#2a1f1a' }}>({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
