'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Search, Shield, RefreshCw } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  export: 'bg-yellow-100 text-yellow-700',
  refund: 'bg-orange-100 text-orange-700',
  status_change: 'bg-cyan-100 text-cyan-700',
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  async function logAction(action: string, entity: string, details: string) {
    await supabase.from('audit_logs').insert({
      action,
      entity,
      details,
      user_email: 'admin@gameofbones.in',
      created_at: new Date().toISOString(),
    })
  }

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || log.action === filter
    const matchDate =
      (!dateFrom || new Date(log.created_at) >= new Date(dateFrom)) &&
      (!dateTo || new Date(log.created_at) <= new Date(dateTo + 'T23:59:59'))
    return matchSearch && matchFilter && matchDate
  })

  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean)

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">Every action ever taken in the admin panel</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Actions', value: logs.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Today', value: logs.filter(l => l.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length, color: 'bg-green-50 text-green-700' },
          { label: 'This Week', value: logs.filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)).length, color: 'bg-orange-50 text-orange-700' },
          { label: 'Team Members', value: new Set(logs.map(l => l.user_email)).size, color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={"rounded-xl p-4 " + s.color}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search actions, entities, users..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')}
          className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
          All ({logs.length})
        </button>
        {uniqueActions.map(action => (
          <button key={action} onClick={() => setFilter(action)}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize " + (filter === action ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
            {action} ({actionCounts[action] || 0})
          </button>
        ))}
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading audit logs...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p>No audit logs yet</p>
            <p className="text-xs mt-1">Actions taken in the admin panel will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Time', 'User', 'Action', 'Entity', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-700">{log.user_email || 'Admin'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"text-xs font-semibold px-2 py-0.5 rounded-full capitalize " + (ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600')}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700 capitalize">{log.entity}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}