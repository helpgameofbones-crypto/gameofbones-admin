'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

type Alert = { id: string; product_name: string; email: string | null; phone: string | null; status: string; created_at: string }

export default function RestockAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await authedFetch('/api/admin/restock-alerts')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load stock alerts.')
      setAlerts(payload.alerts || [])
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load stock alerts.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const pending = alerts.filter(alert => alert.status === 'pending')
  return <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px', color: '#1a1008' }}>
    <p style={{ color: '#a66d1e', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', margin: 0 }}>Customer demand</p>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div><h1 style={{ margin: '6px 0 4px', fontSize: 30 }}>Stock alerts</h1><p style={{ margin: 0, color: '#6b625a' }}>Customers waiting for low-stock treats. Contact details are shown only here.</p></div>
      <button onClick={load} style={button}>Refresh</button>
    </div>
    <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
      <div style={stat}><strong>{pending.length}</strong><span>Waiting to be notified</span></div>
      <div style={stat}><strong>{alerts.length}</strong><span>Total requests</span></div>
    </div>
    {error && <p style={{ background: '#fee2e2', color: '#991b1b', padding: 14, borderRadius: 8 }}>{error}</p>}
    {loading ? <p>Loading stock alerts…</p> : alerts.length === 0 ? <div style={empty}>No stock-alert requests yet.</div> : <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eadfce', borderRadius: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}><thead><tr style={{ background: '#1a1008', color: '#fff' }}>{['Treat','Email','Phone','Status','Requested'].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{alerts.map((alert, index) => <tr key={alert.id} style={{ background: index % 2 ? '#fff' : '#fdf9f3' }}><td style={td}><strong>{alert.product_name}</strong></td><td style={td}>{alert.email ? <a href={`mailto:${alert.email}`} style={link}>{alert.email}</a> : '—'}</td><td style={td}>{alert.phone ? <a href={`https://wa.me/${alert.phone.replace(/\D/g, '').replace(/^91/, '91')}`} style={link}>{alert.phone}</a> : '—'}</td><td style={td}><span style={badge}>{alert.status}</span></td><td style={td}>{new Date(alert.created_at).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>}
  </div>
}

const button: React.CSSProperties = { border: 0, borderRadius: 8, background: '#1a1008', color: '#fff', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }
const stat: React.CSSProperties = { minWidth: 170, display: 'grid', gap: 2, padding: '16px 18px', background: '#fff8e7', border: '1px solid #ead5a7', borderRadius: 10 }
const th: React.CSSProperties = { padding: '13px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid #eee5d9', fontSize: 14 }
const link: React.CSSProperties = { color: '#146c61', fontWeight: 600, textDecoration: 'none' }
const badge: React.CSSProperties = { background: '#fff1c9', color: '#8a5a00', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }
const empty: React.CSSProperties = { background: '#fff', border: '1px solid #eadfce', borderRadius: 12, padding: 32, color: '#6b625a' }
