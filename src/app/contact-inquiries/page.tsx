'use client'

import { useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

type Inquiry = { id: string; name: string; email: string; subject: string; message: string; status: 'new' | 'in_progress' | 'resolved'; created_at: string }
const label: Record<Inquiry['status'], string> = { new: 'New', in_progress: 'In progress', resolved: 'Resolved' }

export default function ContactInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [filter, setFilter] = useState<'all' | Inquiry['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try { const response = await authedFetch('/api/contact-inquiries'); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load enquiries.'); setInquiries(data.inquiries || []) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load enquiries.') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const shown = useMemo(() => filter === 'all' ? inquiries : inquiries.filter(item => item.status === filter), [filter, inquiries])
  const updateStatus = async (id: string, status: Inquiry['status']) => {
    const response = await authedFetch('/api/contact-inquiries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || 'Status could not be saved.'); return }
    setInquiries(items => items.map(item => item.id === id ? { ...item, status } : item))
  }
  const newCount = inquiries.filter(item => item.status === 'new').length
  return <div style={styles.page}>
    <header style={styles.header}><div><p style={styles.eyebrow}>Customer support</p><h1 style={styles.title}>Contact enquiries</h1><p style={styles.subtitle}>Messages sent from the storefront contact form. Customer details are only visible to signed-in admins.</p></div><button onClick={load} style={styles.refresh}>Refresh</button></header>
    <div style={styles.filters}><strong>{newCount} new</strong><div style={styles.filterGroup}>{(['all', 'new', 'in_progress', 'resolved'] as const).map(value => <button key={value} onClick={() => setFilter(value)} style={{ ...styles.filter, ...(filter === value ? styles.filterActive : {}) }}>{value === 'all' ? 'All' : label[value]}</button>)}</div></div>
    {error && <p style={styles.error}>{error}</p>}
    {loading ? <p style={styles.empty}>Loading enquiries…</p> : shown.length === 0 ? <p style={styles.empty}>No {filter === 'all' ? '' : label[filter].toLowerCase() + ' '}enquiries yet.</p> : <div style={styles.list}>{shown.map(item => <article key={item.id} style={styles.card}><div style={styles.cardHead}><div><p style={styles.meta}>{new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p><h2 style={styles.name}>{item.name}</h2><a style={styles.email} href={`mailto:${item.email}`}>{item.email}</a></div><select aria-label={`Set status for ${item.name}'s enquiry`} value={item.status} onChange={event => updateStatus(item.id, event.target.value as Inquiry['status'])} style={{ ...styles.status, ...(item.status === 'resolved' ? styles.resolved : item.status === 'in_progress' ? styles.progress : styles.new) }}>{(['new', 'in_progress', 'resolved'] as const).map(status => <option key={status} value={status}>{label[status]}</option>)}</select></div><p style={styles.subject}>{item.subject}</p><p style={styles.message}>{item.message}</p></article>)}</div>}
  </div>
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '34px 26px 60px', color: '#1a1008' }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 24, marginBottom: 24 }, eyebrow: { margin: 0, color: '#b7791f', fontWeight: 800, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }, title: { margin: '6px 0', fontSize: 32, lineHeight: 1.1 }, subtitle: { maxWidth: 620, margin: 0, color: '#6b6258', lineHeight: 1.5 }, refresh: { background: '#1a1008', color: '#fff', border: 0, borderRadius: 5, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }, filters: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '14px 16px', background: '#fff', border: '1px solid #e8dfd1', marginBottom: 18 }, filterGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' }, filter: { padding: '7px 10px', border: '1px solid #d9cfbe', background: '#fff', color: '#544b40', cursor: 'pointer', fontWeight: 700, borderRadius: 4 }, filterActive: { background: '#e8c76d', borderColor: '#c8973a', color: '#1a1008' }, error: { padding: 14, background: '#fde7e5', border: '1px solid #e68d82', color: '#8a2419' }, empty: { padding: 36, textAlign: 'center', background: '#fff', border: '1px solid #e8dfd1', color: '#6b6258' }, list: { display: 'grid', gap: 14 }, card: { background: '#fff', border: '1px solid #e8dfd1', padding: 20 }, cardHead: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start' }, meta: { margin: 0, color: '#8a7f73', fontSize: 12 }, name: { margin: '5px 0 3px', fontSize: 20 }, email: { color: '#176a5a', fontWeight: 700 }, subject: { display: 'inline-block', margin: '18px 0 8px', padding: '5px 8px', background: '#f5e8c8', fontSize: 12, fontWeight: 800 }, message: { whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6, color: '#413a32' }, status: { padding: '8px 10px', fontWeight: 800, borderRadius: 4, border: '1px solid #d9cfbe', cursor: 'pointer' }, new: { background: '#fff0c7', color: '#774b00' }, progress: { background: '#dcecf0', color: '#135d70' }, resolved: { background: '#dcebdd', color: '#24643e' },
}
