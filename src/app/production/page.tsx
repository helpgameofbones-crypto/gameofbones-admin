'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Plus, X, ChevronDown, ChevronUp, Download, BarChart2, Clock, TrendingUp, Package } from 'lucide-react'

export default function ProductionPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState('')
  const [form, setForm] = useState({
    batch_name: '', batch_id: '', start_time: '', end_time: '',
    price_per_kg: '', total_kg: '', transportation: '', notes: '',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { fetchBatches() }, [])

  async function fetchBatches() {
    setLoading(true)
    const { data } = await supabase
      .from('production_batches')
      .select('*')
      .order('date', { ascending: false })
    setBatches(data || [])
    setLoading(false)
  }

  function calcBatch(f: typeof form) {
    const total_kg = parseFloat(f.total_kg) || 0
    const price_per_kg = parseFloat(f.price_per_kg) || 0
    const transportation = parseFloat(f.transportation) || 0
    const price = total_kg * price_per_kg
    const total_cost = price + transportation

    let run_time_hours = 0
    if (f.start_time && f.end_time) {
      const [sh, sm] = f.start_time.split(':').map(Number)
      const [eh, em] = f.end_time.split(':').map(Number)
      run_time_hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
      if (run_time_hours < 0) run_time_hours += 24
    }

    return { total_kg, price_per_kg, transportation, price, total_cost, run_time_hours }
  }

  async function submitBatch() {
    const c = calcBatch(form)
    const yield_g = parseFloat((form as any).yield_g) || 0
    const yield_pct = c.total_kg > 0 ? Math.round((yield_g / (c.total_kg * 1000)) * 100) : 0
    const run_time = `${Math.floor(c.run_time_hours)}h ${Math.round((c.run_time_hours % 1) * 60)}m`

    const { error } = await supabase.from('production_batches').insert({
      ...form,
      price: c.price,
      total_cost: c.total_cost,
      run_time_hours: c.run_time_hours,
      run_time,
      total_grams: c.total_kg * 1000,
      yield_g,
      yield_pct,
    })
    if (!error) {
      setShowForm(false)
      setForm({ batch_name: '', batch_id: '', start_time: '', end_time: '', price_per_kg: '', total_kg: '', transportation: '', notes: '', date: new Date().toISOString().split('T')[0] })
      fetchBatches()
    }
  }

  const months = [...new Set(batches.map(b => b.date?.slice(0, 7)))].sort().reverse()

  const filtered = batches.filter(b => !monthFilter || b.date?.startsWith(monthFilter))

  const monthlyStats = months.map(month => {
    const mb = batches.filter(b => b.date?.startsWith(month))
    return {
      month,
      batches: mb.length,
      total_kg: mb.reduce((s, b) => s + (parseFloat(b.total_kg) || 0), 0),
      total_cost: mb.reduce((s, b) => s + (b.total_cost || 0), 0),
      total_yield_g: mb.reduce((s, b) => s + (b.yield_g || 0), 0),
      avg_yield_pct: mb.length > 0 ? Math.round(mb.reduce((s, b) => s + (b.yield_pct || 0), 0) / mb.length) : 0,
      run_hours: mb.reduce((s, b) => s + (b.run_time_hours || 0), 0),
    }
  })

  const live = calcBatch(form)
  const liveYieldG = parseFloat((form as any).yield_g) || 0
  const liveYieldPct = live.total_kg > 0 ? Math.round((liveYieldG / (live.total_kg * 1000)) * 100) : 0

  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonth = monthlyStats.find(m => m.month === currentMonth)

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: "#f9f6f2", minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track every batch â€” cost, yield, time and profitability</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          <Plus size={16} /> Log Batch
        </button>
      </div>

      {/* This Month Summary */}
      {thisMonth && (
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 mb-6 text-white">
          <div className="text-sm font-medium opacity-80 mb-3">This Month â€” {formatMonth(currentMonth)}</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Batches Run', value: thisMonth.batches },
              { label: 'Raw Material', value: `${thisMonth.total_kg.toFixed(1)} kg` },
              { label: 'Total Cost', value: `â‚¹${thisMonth.total_cost.toLocaleString('en-IN')}` },
              { label: 'Total Yield', value: `${(thisMonth.total_yield_g / 1000).toFixed(2)} kg` },
              { label: 'Avg Yield %', value: `${thisMonth.avg_yield_pct}%` },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Summary Table */}
      {monthlyStats.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm mb-6">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <BarChart2 size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Monthly Summary</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Month', 'Batches', 'Raw (kg)', 'Total Cost', 'Yield (g)', 'Yield %', 'Hours'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthlyStats.map(m => (
                <tr key={m.month} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{formatMonth(m.month)}</td>
                  <td className="px-4 py-3 text-gray-700">{m.batches}</td>
                  <td className="px-4 py-3 text-gray-700">{m.total_kg.toFixed(1)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">â‚¹{m.total_cost.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-700">{m.total_yield_g.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.avg_yield_pct >= 60 ? 'bg-green-100 text-green-700' : m.avg_yield_pct >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {m.avg_yield_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{m.run_hours.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Month Filter */}
      <div className="flex items-center gap-3 mb-4">
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} batch{filtered.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Batch List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading batches...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No batches logged yet</p>
          <p className="text-xs mt-1">Click "Log Batch" to add your first production batch</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(batch => {
            const isExp = expanded === batch.id
            return (
              <div key={batch.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={() => setExpanded(isExp ? null : batch.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm shrink-0">
                      #{batch.batch_id || 'â€”'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{batch.batch_name}</div>
                      <div className="text-xs text-gray-400">{new Date(batch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-gray-900">{batch.total_kg} kg</div>
                      <div className="text-xs text-gray-400">Raw</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-red-600">â‚¹{(batch.total_cost || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-gray-400">Total Cost</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-700">{(batch.yield_g || 0).toLocaleString('en-IN')} g</div>
                      <div className="text-xs text-gray-400">Yield</div>
                    </div>
                    <div className="text-center">
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${(batch.yield_pct || 0) >= 60 ? 'bg-green-100 text-green-700' : (batch.yield_pct || 0) >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {batch.yield_pct || 0}%
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">Yield %</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-700">{batch.run_time || 'â€”'}</div>
                      <div className="text-xs text-gray-400">Run Time</div>
                    </div>
                    {isExp ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-gray-50 p-4 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: 'Batch ID', value: batch.batch_id || 'â€”' },
                        { label: 'Start Time', value: batch.start_time || 'â€”' },
                        { label: 'End Time', value: batch.end_time || 'â€”' },
                        { label: 'Run Time', value: batch.run_time || 'â€”' },
                        { label: 'Price/kg', value: `â‚¹${batch.price_per_kg || 0}` },
                        { label: 'Raw Material Cost', value: `â‚¹${(batch.price || 0).toLocaleString('en-IN')}` },
                        { label: 'Transportation', value: `â‚¹${(batch.transportation || 0).toLocaleString('en-IN')}` },
                        { label: 'Total Grams', value: `${((batch.total_kg || 0) * 1000).toLocaleString('en-IN')} g` },
                      ].map(d => (
                        <div key={d.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                          <div className="text-xs text-gray-400">{d.label}</div>
                          <div className="text-sm font-semibold text-gray-800">{d.value}</div>
                        </div>
                      ))}
                    </div>
                    {batch.notes && (
                      <div className="bg-white rounded-lg p-3 border border-gray-100 text-sm text-gray-600">
                        ðŸ“ {batch.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Log Production Batch</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="space-y-4">
              {/* Batch Info */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Batch Name *</label>
                  <input value={form.batch_name} onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))}
                    placeholder="e.g. Chicken Jerky Batch" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Batch ID</label>
                  <input value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))}
                    placeholder="e.g. CJ-001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              {/* Run time preview */}
              {form.start_time && form.end_time && (
                <div className="bg-blue-50 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
                  <Clock size={14} />
                  Run Time: {Math.floor(live.run_time_hours)}h {Math.round((live.run_time_hours % 1) * 60)}m
                </div>
              )}

              {/* Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Price per kg (â‚¹) *</label>
                  <input type="number" value={form.price_per_kg} onChange={e => setForm(f => ({ ...f, price_per_kg: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Total kg *</label>
                  <input type="number" step="0.1" value={form.total_kg} onChange={e => setForm(f => ({ ...f, total_kg: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Transportation (â‚¹)</label>
                  <input type="number" value={form.transportation} onChange={e => setForm(f => ({ ...f, transportation: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              {/* Yield */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Yield (grams after dehydration) *</label>
                <input type="number" value={(form as any).yield_g || ''} onChange={e => setForm(f => ({ ...f, yield_g: e.target.value } as any))}
                  placeholder="e.g. 4500" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              {/* Live Cost Preview */}
              {(live.total_kg > 0 || live.price > 0) && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Raw Material Cost', value: `â‚¹${live.price.toLocaleString('en-IN')}` },
                    { label: 'Transportation', value: `â‚¹${live.transportation.toLocaleString('en-IN')}` },
                    { label: 'Total Cost', value: `â‚¹${live.total_cost.toLocaleString('en-IN')}`, bold: true },
                    { label: 'Yield %', value: `${liveYieldPct}%`, bold: true },
                  ].map(d => (
                    <div key={d.label} className="text-center">
                      <div className={`text-lg ${d.bold ? 'font-bold text-orange-700' : 'font-semibold text-gray-800'}`}>{d.value}</div>
                      <div className="text-xs text-gray-500">{d.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any observations, issues, or remarks..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={submitBatch} disabled={!form.batch_name || !form.total_kg || !form.price_per_kg}
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  Save Batch
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
