'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
)

function parseItems(items: any) {
  if (!items) return []
  if (typeof items === 'string') { try { items = JSON.parse(items) } catch { return [] } }
  if (!Array.isArray(items)) return []
  return items.map((it: any) => `${it.name || 'Item'}${it.sizeLabel ? ' (' + it.sizeLabel + ')' : ''}${it.qty > 1 ? ' x' + it.qty : ''}`)
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'has_contact' | 'recovered'>('all')

  useEffect(() => { fetchCarts() }, [])

  async function fetchCarts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .order('abandoned_at', { ascending: false })
      .limit(300)
    if (error) { console.error(error); setLoading(false); return }
    setCarts(data || [])
    setLoading(false)
  }

  const filtered = carts.filter(c => {
    if (filter === 'has_contact') return !!(c.customer_phone || c.customer_email)
    if (filter === 'recovered') return c.recovered
    return true
  })

  const notRecovered = carts.filter(c => !c.recovered)
  const withContact = notRecovered.filter(c => c.customer_phone || c.customer_email)
  const totalValueAtRisk = notRecovered.reduce((s, c) => s + (parseFloat(c.total) || 0), 0)
  const recoveredCount = carts.filter(c => c.recovered).length

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Abandoned Carts</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        Customers who added items to cart but didn't complete checkout. Contact info is only captured if they reached the checkout page and started typing — most abandon earlier, so many rows here are anonymous by nature, not a bug.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{notRecovered.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Not Recovered</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>{recoveredCount}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Recovered</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b' }}>{withContact.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Have Contact Info</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>₹{totalValueAtRisk.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Value At Risk</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'has_contact', 'recovered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              background: filter === f ? '#1a1008' : '#f3f4f6', color: filter === f ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            {f === 'all' ? `All (${carts.length})` : f === 'has_contact' ? `Has Contact (${carts.filter(c=>c.customer_phone||c.customer_email).length})` : `Recovered (${recoveredCount})`}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Customer</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Items</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Value</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Abandoned</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#6b7280', fontWeight: 600 }}>Recover</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No abandoned carts match this filter.</td></tr>
            ) : filtered.map((c) => {
              const items = parseItems(c.items)
              const hasContact = !!(c.customer_phone || c.customer_email)
              const waMsg = `Hi${c.customer_name ? ' ' + c.customer_name : ''}! 🐾 You left some treats in your cart at Game of Bones — ${items.slice(0,2).join(', ')}${items.length > 2 ? '...' : ''} (₹${c.total}). Complete your order at gameofbones.in — free shipping on all orders!`
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: c.recovered ? 0.55 : 1 }}>
                  <td style={{ padding: '12px 16px' }}>
                    {hasContact ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{c.customer_name || 'Unknown name'}</div>
                        {c.customer_phone && <div style={{ fontSize: 11, color: '#6b7280' }}>📱 {c.customer_phone}</div>}
                        {c.customer_email && <div style={{ fontSize: 11, color: '#9ca3af' }}>📧 {c.customer_email}</div>}
                      </>
                    ) : (
                      <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Anonymous (left before checkout)</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151', maxWidth: 260 }}>
                    {items.length > 0 ? items.slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{parseFloat(c.total || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12 }}>{new Date(c.abandoned_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
                      background: c.recovered ? '#dcfce7' : '#fef3c7', color: c.recovered ? '#16a34a' : '#92400e' }}>
                      {c.recovered ? 'Recovered' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {!c.recovered && hasContact ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {c.customer_phone && (
                          <a href={`https://wa.me/91${c.customer_phone}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener"
                            style={{ padding: '5px 10px', background: '#25d366', color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                            💬
                          </a>
                        )}
                        {c.customer_email && (
                          <a href={`mailto:${c.customer_email}?subject=${encodeURIComponent('You left something in your cart 🐾')}&body=${encodeURIComponent(waMsg)}`}
                            style={{ padding: '5px 10px', background: '#1a1008', color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                            ✉️
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 11 }}>{c.recovered ? '—' : 'No contact'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
