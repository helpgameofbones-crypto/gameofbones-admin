'use client'

import { useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

type Prospect = { name: string; email: string; phone: string; sources: string[]; latest_at: string }

function csvCell(value: string) { return `"${value.replace(/"/g, '""')}"` }

export default function ProspectsPage() {
  const [rows, setRows] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await authedFetch('/api/admin/prospects')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load prospects.')
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load prospects.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return text ? rows.filter(row => `${row.name} ${row.email} ${row.phone} ${row.sources.join(' ')}`.toLowerCase().includes(text)) : rows
  }, [rows, query])
  const withEmail = filtered.filter(row => row.email).length

  function download() {
    const contents = [['Name', 'Email', 'Phone', 'Captured from', 'Latest signal'], ...filtered.map(row => [row.name, row.email, row.phone, row.sources.join(' + '), row.latest_at])]
      .map(row => row.map(value => csvCell(String(value || ''))).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `game-of-bones-prospects-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return <main style={{ maxWidth: 1260, margin: '0 auto', padding: '30px 28px 60px' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'end', flexWrap: 'wrap', borderBottom: '1px solid #e6dccb', paddingBottom: 20 }}>
      <div><p style={{ margin: '0 0 5px', color: '#9a6514', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>Growth audience</p><h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 32, letterSpacing: '-.04em' }}>Prospects — no purchase found</h1><p style={{ maxWidth: 700, margin: '8px 0 0', color: '#746759', fontSize: 13, lineHeight: 1.5 }}>Combined from Cart Recovery and Spin & Leads. Records with a name or email are kept; any match to a paid or valid COD order by email, phone, or name is excluded.</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button onClick={download} disabled={!filtered.length} style={button}>Download CSV</button><button onClick={load} style={{ ...button, background: '#fffdf9', color: '#1a1008', border: '1px solid #cfc1ae' }}>Refresh</button></div>
    </header>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, margin: '22px 0' }}>
      <Stat label="Non-buyers" value={loading ? '—' : String(rows.length)} /><Stat label="With email" value={loading ? '—' : String(rows.filter(row => row.email).length)} /><Stat label="With phone" value={loading ? '—' : String(rows.filter(row => row.phone).length)} />
    </section>
    <label style={{ display: 'grid', gap: 6, maxWidth: 440, marginBottom: 16, fontSize: 11, color: '#746759', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Search prospects<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, phone or source" style={{ minHeight: 42, padding: '0 12px', font: '14px system-ui', border: '1px solid #cfc1ae', background: '#fffdf9', textTransform: 'none', letterSpacing: 0 }} /></label>
    {error && <p style={{ padding: 14, background: '#fee2e2', color: '#991b1b' }}>{error}</p>}
    <div style={{ overflowX: 'auto', background: '#fffdf9', border: '1px solid #dfd3c1' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ background: '#1a1008', color: '#fff' }}><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Phone</th><th style={th}>Captured from</th><th style={th}>Latest signal</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} style={empty}>Building prospect list…</td></tr> : !filtered.length ? <tr><td colSpan={5} style={empty}>No non-buying prospects match this search.</td></tr> : filtered.map((row, index) => <tr key={`${row.email}-${row.phone}-${index}`} style={{ background: index % 2 ? '#fff' : '#faf6f0' }}><td style={td}>{row.name || '—'}</td><td style={td}>{row.email ? <a href={`mailto:${row.email}`} style={{ color: '#176b5d' }}>{row.email}</a> : '—'}</td><td style={td}>{row.phone || '—'}</td><td style={td}>{row.sources.map(source => <span key={source} style={badge}>{source}</span>)}</td><td style={td}>{row.latest_at ? new Date(row.latest_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td></tr>)}</tbody></table></div>
    {!loading && <p style={{ color: '#746759', fontSize: 12, marginTop: 10 }}>{filtered.length} shown · {withEmail} with an email address in this view.</p>}
  </main>
}

function Stat({ label, value }: { label: string; value: string }) { return <div style={{ border: '1px solid #dfd3c1', padding: '16px 18px', background: '#fffdf9' }}><strong style={{ fontSize: 27 }}>{value}</strong><span style={{ display: 'block', marginTop: 4, color: '#746759', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span></div> }
const button: React.CSSProperties = { minHeight: 40, padding: '0 14px', border: 'none', background: '#1a1008', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12 }
const th: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '13px 14px', borderBottom: '1px solid #eee4d7', verticalAlign: 'top' }
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: '#746759' }
const badge: React.CSSProperties = { display: 'inline-block', padding: '4px 7px', margin: '0 5px 4px 0', background: '#f5e8c8', color: '#6d4a12', fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }
