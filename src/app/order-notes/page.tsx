'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Search, Plus, Send, FileText } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OrderNotesPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, ref, customer_name, customer_phone, status, created_at, grand_total, total_amount, order_notes')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function addNote(orderId: string) {
    if (!newNote.trim()) return
    setAdding(true)
    const order = orders.find(o => o.id === orderId)
    const existing = order?.order_notes || []
    const note = {
      text: newNote.trim(),
      timestamp: new Date().toISOString(),
      author: 'Admin',
    }
    const updated = [...existing, note]
    await supabase.from('orders').update({ order_notes: updated }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_notes: updated } : o))
    setSelected((prev: any) => prev?.id === orderId ? { ...prev, order_notes: updated } : prev)
    setNewNote('')
    setAdding(false)
  }

  const filtered = orders.filter(o =>
    !search ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.ref?.includes(search) || o.order_number?.includes(search) ||
    o.customer_phone?.includes(search)
  )

  const ordersWithNotes = orders.filter(o => (o.order_notes || []).length > 0)

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order Notes History</h1>
        <p className="text-sm text-gray-500 mt-1">View and add notes to any order</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-700">{ordersWithNotes.length}</div>
          <div className="text-xs font-medium text-blue-600 mt-1">Orders with Notes</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-700">
            {orders.reduce((s, o) => s + (o.order_notes || []).length, 0)}
          </div>
          <div className="text-xs font-medium text-orange-600 mt-1">Total Notes</div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search orders..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-20 text-gray-400">Loading...</div>
          ) : filtered.map(order => {
            const notes = order.order_notes || []
            const isSelected = selected?.id === order.id
            return (
              <div key={order.id} onClick={() => setSelected(order)}
                className={"bg-white border rounded-xl p-4 cursor-pointer transition-all shadow-sm " + (isSelected ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-100 hover:border-gray-300')}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">#{order.ref || order.order_number}</div>
                    <div className="text-xs text-gray-400">{order.customer_name} · {new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {notes.length > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        {notes.length} note{notes.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                      {order.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                {notes.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 truncate">
                    Latest: {notes[notes.length - 1].text}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Notes Detail */}
        <div className="lg:sticky lg:top-6">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>Click an order to view and add notes</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <div className="font-bold text-gray-900">#{selected.ref || selected.order_number}</div>
                <div className="text-sm text-gray-500">{selected.customer_name} · ₹{(selected.grand_total || selected.total_amount || 0).toLocaleString('en-IN')}</div>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto space-y-3">
                {(selected.order_notes || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No notes yet</div>
                ) : (
                  [...(selected.order_notes || [])].reverse().map((note: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-800">{note.text}</div>
                      <div className="text-xs text-gray-400 mt-1.5 flex items-center justify-between">
                        <span>{note.author || 'Admin'}</span>
                        <span>{new Date(note.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-50">
                <div className="flex gap-2">
                  <input
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote(selected.id)}
                    placeholder="Add a note..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                  <button onClick={() => addNote(selected.id)} disabled={adding || !newNote.trim()}
                    className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}