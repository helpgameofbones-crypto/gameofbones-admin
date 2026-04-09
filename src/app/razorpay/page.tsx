'use client'
import { useEffect, useState } from 'react'

export default function RazorpayPage() {
  const [tab, setTab]             = useState('payments')
  const [payments, setPayments]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [refunding, setRefunding] = useState<string | null>(null)
  const [msg, setMsg]             = useState('')
  const [search, setSearch]       = useState('')
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [refundModal, setRefundModal] = useState<any>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote]     = useState('')

  useEffect(() => { fetchPayments() }, [])

  async function fetchPayments() {
    setLoading(true)
    try {
      const res = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_payments',
          data: { from: dateFrom, to: dateTo, count: '100' }
        })
      })
      const data = await res.json()
      setPayments(data.data?.items || [])
    } catch {
      setMsg(' Failed to load payments')
    }
    setLoading(false)
  }

  async function issueRefund() {
    if (!refundModal || !refundAmount) return
    setRefunding(refundModal.id)
    try {
      const res = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refund',
          data: {
            payment_id: refundModal.id,
            amount:     parseFloat(refundAmount),
            notes:      refundNote,
          }
        })
      })
      const data = await res.json()
      if (data.ok && data.data?.id) {
        setMsg(` Refund of ${refundAmount} issued! Refund ID: ${data.data.id}`)
        setRefundModal(null)
        setRefundAmount('')
        setRefundNote('')
        fetchPayments()
      } else {
        setMsg(' Refund failed: ' + (data.data?.description || data.error))
      }
    } catch {
      setMsg(' Refund failed')
    }
    setRefunding(null)
    setTimeout(() => setMsg(''), 5000)
  }

  const filtered = payments.filter(p =>
    !search ||
    p.id?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.contact?.includes(search) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  const totalCaptured  = payments.filter(p => p.status === 'captured').reduce((s, p) => s + (p.amount || 0), 0) / 100
  const totalRefunded  = payments.filter(p => p.status === 'refunded').reduce((s, p) => s + (p.amount || 0), 0) / 100
  const totalFailed    = payments.filter(p => p.status === 'failed').length
  const successRate    = payments.length > 0
    ? Math.round((payments.filter(p => p.status === 'captured').length / payments.length) * 100)
    : 0

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Razorpay',  href: '/razorpay' },
    { label: 'Finance',   href: '/finance' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
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
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Razorpay</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
              Payments, refunds, reconciliation
            </p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              style={{ color: '#111827' }}
            />
            <span style={{ color: '#1a1008' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              style={{ color: '#111827' }}
            />
            <button onClick={fetchPayments}
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: '#1a1008' }}>
              Load
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Collected',  value: '' + totalCaptured.toLocaleString('en-IN'),  icon: '', color: '#10b981' },
            { label: 'Total Refunded',   value: '' + totalRefunded.toLocaleString('en-IN'),  icon: '', color: '#ef4444' },
            { label: 'Failed Payments',  value: totalFailed,                                   icon: '', color: '#f59e0b' },
            { label: 'Success Rate',     value: successRate + '%',                             icon: '', color: '#3b82f6' },
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

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by payment ID, email, phone..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-80 focus:outline-none bg-white"
            style={{ color: '#111827' }}
          />
          <div className="flex gap-2">
            {['all','captured','refunded','failed'].map(s => (
              <button key={s} onClick={() => setTab(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
                style={{
                  background: tab === s ? '#1a1008' : 'white',
                  color: tab === s ? 'white' : '#6b7280',
                  border: '1px solid #e5e7eb'
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Payment ID','Customer','Amount','Method','Status','Date','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                  Loading payments from Razorpay...
                </td></tr>
              ) : filtered.filter(p => tab === 'all' || p.status === tab).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>
                  No payments found
                </td></tr>
              ) : filtered.filter(p => tab === 'all' || p.status === tab).map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1a1008' }}>
                    {payment.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm" style={{ color: '#111827' }}>
                      {payment.email || ''}
                    </div>
                    <div className="text-xs" style={{ color: '#2a1f1a' }}>{payment.contact}</div>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#111827' }}>
                    {((payment.amount || 0) / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: '#1a1008' }}>
                    {payment.method}
                    {payment.bank ? `  ${payment.bank}` : ''}
                    {payment.card_id ? '  Card' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                      style={{
                        background: payment.status === 'captured' ? '#dcfce7' :
                          payment.status === 'refunded' ? '#dbeafe' :
                          payment.status === 'failed' ? '#fef2f2' : '#f3f4f6',
                        color: payment.status === 'captured' ? '#166534' :
                          payment.status === 'refunded' ? '#1e40af' :
                          payment.status === 'failed' ? '#ef4444' : '#374151'
                      }}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#1a1008' }}>
                    {new Date(payment.created_at * 1000).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    {payment.status === 'captured' && (
                      <button
                        onClick={() => {
                          setRefundModal(payment)
                          setRefundAmount(((payment.amount || 0) / 100).toString())
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: '#fef2f2', color: '#ef4444' }}>
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Issue Refund</div>
              <button onClick={() => setRefundModal(null)}
                className="text-2xl font-light" style={{ color: '#2a1f1a' }}></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg" style={{ background: '#f9fafb' }}>
                <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#1a1008' }}>Payment</div>
                <div className="font-mono text-sm" style={{ color: '#1a1008' }}>{refundModal.id}</div>
                <div className="text-sm mt-1" style={{ color: '#1a1008' }}>
                  {((refundModal.amount || 0) / 100).toLocaleString('en-IN')}  {refundModal.email}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>
                  Refund Amount ()
                </label>
                <input type="number" value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  max={(refundModal.amount || 0) / 100}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
                <div className="text-xs mt-1" style={{ color: '#2a1f1a' }}>
                  Max: {((refundModal.amount || 0) / 100).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Reason</label>
                <input value={refundNote} onChange={e => setRefundNote(e.target.value)}
                  placeholder="Reason for refund..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#fef2f2' }}>
                <p className="text-xs" style={{ color: '#ef4444' }}>
                   This will immediately refund {refundAmount} to the customer. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRefundModal(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#1a1008' }}>
                  Cancel
                </button>
                <button onClick={issueRefund} disabled={refunding === refundModal.id}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#ef4444' }}>
                  {refunding === refundModal.id ? 'Processing...' : `Refund ${refundAmount}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
