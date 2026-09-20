'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ClipboardList, PackageCheck, TriangleAlert, Truck, WalletCards } from 'lucide-react'

type TrendPoint = { date: string; revenue: number; orders: number }
type RecentOrder = { id: string; ref: string; created_at: string | null; status: string; payment_status: string; payment_method: string; total: number; customer_name: string; customer_phone: string; has_awb: boolean }
type DashboardData = {
  generated_at: string
  metrics: { today_revenue: number; today_orders: number; week_revenue: number; week_orders: number; month_revenue: number; month_orders: number; average_order_value: number; cod_rate: number; total_orders: number }
  queues: { ready_to_book: number; failed_payments: number; missing_addresses: number; delivery_exceptions: number }
  status_counts: Record<string, number>
  trend: TrendPoint[]
  recent_orders: RecentOrder[]
}

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
const statusColors: Record<string, { foreground: string; background: string }> = {
  delivered: { foreground: '#17603a', background: '#e8f6ed' }, confirmed: { foreground: '#1d4f91', background: '#eaf2fd' },
  dispatched: { foreground: '#6b3fa0', background: '#f2ebfb' }, shipped: { foreground: '#6b3fa0', background: '#f2ebfb' },
  cancelled: { foreground: '#a02823', background: '#ffebe8' },
}
const panelStyle = { background: '#fffdf9', border: '1px solid #ded3c2', borderRadius: 10, boxShadow: '0 8px 22px rgba(59,37,12,.045)' }
const panelHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '18px 20px 8px' }
const eyebrowStyle = { margin: '0 0 5px', color: '#9a6514', fontSize: 10, fontWeight: 900, letterSpacing: '.13em', textTransform: 'uppercase' as const }
const sectionTitleStyle = { margin: 0, color: '#1a1008', fontFamily: 'Georgia, serif', fontSize: 22, letterSpacing: '-.03em' }

function RevenueChart({ points }: { points: TrendPoint[] }) {
  const [period, setPeriod] = useState<7 | 14 | 30>(14)
  const data = points.slice(-period)
  const max = Math.max(...data.map(point => point.revenue), 1)
  const width = 760, height = 248, pad = { top: 18, right: 16, bottom: 34, left: 62 }
  const chartWidth = width - pad.left - pad.right, chartHeight = height - pad.top - pad.bottom
  const path = data.map((point, index) => {
    const x = pad.left + (index / Math.max(data.length - 1, 1)) * chartWidth
    const y = pad.top + chartHeight - (point.revenue / max) * chartHeight
    return `${index ? 'L' : 'M'} ${x} ${y}`
  }).join(' ')
  const area = `${path} L ${pad.left + chartWidth} ${pad.top + chartHeight} L ${pad.left} ${pad.top + chartHeight} Z`
  const labelEvery = period === 30 ? 5 : period === 14 ? 3 : 1

  return <section aria-labelledby="revenue-heading" style={panelStyle}>
    <div style={panelHeaderStyle}><div><p style={eyebrowStyle}>Revenue pulse</p><h2 id="revenue-heading" style={sectionTitleStyle}>Sales over time</h2></div><div role="group" aria-label="Revenue period" style={{ display: 'flex', gap: 4, background: '#f2ede3', padding: 3, borderRadius: 6 }}>{([7, 14, 30] as const).map(days => <button key={days} type="button" onClick={() => setPeriod(days)} aria-pressed={period === days} style={{ minHeight: 32, padding: '0 10px', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 800, background: period === days ? '#153c31' : 'transparent', color: period === days ? '#fff' : '#625548' }}>{days}D</button>)}</div></div>
    <div style={{ height: 250 }}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${period}-day revenue chart`} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      {[0, .25, .5, .75, 1].map(tick => { const y = pad.top + chartHeight - tick * chartHeight; return <g key={tick}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#ebe3d6" strokeWidth="1" /><text x={pad.left - 9} y={y + 4} textAnchor="end" fill="#7d7062" fontSize="10">{money(Math.round(max * tick))}</text></g> })}
      <path d={area} fill="url(#revenue-fill)" /><path d={path} fill="none" stroke="#b7761e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((point, index) => { if (index % labelEvery !== 0 && index !== data.length - 1) return null; const x = pad.left + (index / Math.max(data.length - 1, 1)) * chartWidth; const y = pad.top + chartHeight - (point.revenue / max) * chartHeight; return <g key={point.date}><circle cx={x} cy={y} r="3.5" fill="#b7761e" stroke="#fffdf8" strokeWidth="2" /><text x={x} y={height - 10} textAnchor="middle" fill="#7d7062" fontSize="10">{point.date.slice(8, 10)}/{point.date.slice(5, 7)}</text></g> })}
      <defs><linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d9ae6a" stopOpacity=".38" /><stop offset="1" stopColor="#d9ae6a" stopOpacity=".03" /></linearGradient></defs>
    </svg></div><p style={{ margin: '10px 20px 18px', color: '#75685a', fontSize: 11 }}>Confirmed order value. Cancelled and failed-payment orders are excluded.</p>
  </section>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; async function load() { try { const response = await fetch('/api/admin/dashboard', { credentials: 'same-origin', cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to load dashboard data.'); if (active) setData(payload as DashboardData) } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.') } finally { if (active) setLoading(false) } } void load(); return () => { active = false } }, [])
  const attention = useMemo(() => data ? [
    { label: 'Ready to book', detail: 'Paid or COD-confirmed orders without a Delhivery AWB.', count: data.queues.ready_to_book, href: '/delhivery', icon: PackageCheck, tone: '#9b5c08', background: '#fff3dc' },
    { label: 'Payment failures', detail: 'Payments marked failed — verify these before fulfilment.', count: data.queues.failed_payments, href: '/orders', icon: WalletCards, tone: '#a12823', background: '#ffebe8' },
    { label: 'Address gaps', detail: 'Confirmed orders with no usable delivery address.', count: data.queues.missing_addresses, href: '/orders', icon: ClipboardList, tone: '#7a4b11', background: '#f8edd9' },
    { label: 'Delivery exceptions', detail: 'Returns, RTOs, or delivery failures that need a decision.', count: data.queues.delivery_exceptions, href: '/returns', icon: Truck, tone: '#69429a', background: '#f3edfb' },
  ] : [], [data])
  const activeAttention = attention.filter(item => item.count > 0)
  if (error) return <div className="gob-dashboard" style={{ padding: '30px 28px' }}><section style={{ ...panelStyle, maxWidth: 620, padding: 24, borderColor: '#e7c2bd' }}><TriangleAlert size={24} color="#a12823" /><h1 style={{ ...sectionTitleStyle, marginTop: 12 }}>Dashboard unavailable</h1><p style={{ color: '#6b5d4f', lineHeight: 1.5 }}>{error}</p><button type="button" onClick={() => window.location.reload()} style={{ minHeight: 40, padding: '0 14px', color: '#fff', background: '#153c31', border: 0, borderRadius: 5, fontWeight: 800, cursor: 'pointer' }}>Try again</button></section></div>
  const metrics = data?.metrics
  const kpis = [{ label: 'Today’s sales', value: money(metrics?.today_revenue || 0), detail: `${metrics?.today_orders || 0} orders`, accent: '#17603a' }, { label: '7-day sales', value: money(metrics?.week_revenue || 0), detail: `${metrics?.week_orders || 0} orders`, accent: '#b7761e' }, { label: '30-day sales', value: money(metrics?.month_revenue || 0), detail: `${metrics?.month_orders || 0} orders`, accent: '#153c31' }, { label: 'Ready for shipping', value: String(data?.queues.ready_to_book || 0), detail: 'Orders missing an AWB', accent: (data?.queues.ready_to_book || 0) ? '#a12823' : '#17603a' }]

  return <div className="gob-dashboard" style={{ padding: '28px 28px 48px', maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #ded3c2' }}><div><p style={eyebrowStyle}>Game of Bones · Operations</p><h1 style={{ margin: 0, color: '#153c31', fontFamily: 'Georgia, serif', fontSize: 'clamp(30px, 4vw, 44px)', letterSpacing: '-.05em' }}>Run today with clarity.</h1><p style={{ margin: '8px 0 0', color: '#75685a', fontSize: 13 }}>Your orders, fulfilment risks and sales pulse in one place.</p></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Link href="/orders" style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', background: '#153c31', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Open order queue <ArrowRight size={15} /></Link><Link href="/manual-order" style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', border: '1px solid #bfae97', borderRadius: 5, color: '#1a1008', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Create manual order</Link></div></header>
    <section aria-label="Key performance indicators" className="gob-dashboard-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>{kpis.map(kpi => <article key={kpi.label} style={{ ...panelStyle, padding: 17, borderTop: `3px solid ${kpi.accent}` }}><p style={{ margin: 0, color: '#75685a', fontSize: 10, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>{kpi.label}</p><strong style={{ display: 'block', marginTop: 9, color: '#1a1008', fontFamily: 'Georgia, serif', fontSize: 28, letterSpacing: '-.03em' }}>{loading ? '—' : kpi.value}</strong><span style={{ display: 'block', marginTop: 5, color: '#75685a', fontSize: 12 }}>{loading ? 'Loading…' : kpi.detail}</span></article>)}</section>
    <section aria-labelledby="attention-heading" style={{ ...panelStyle, marginBottom: 20, overflow: 'hidden' }}><div style={panelHeaderStyle}><div><p style={eyebrowStyle}>Work queue</p><h2 id="attention-heading" style={sectionTitleStyle}>What needs a decision</h2></div><span aria-label={`${activeAttention.length} active operational queues`} style={{ minWidth: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 15, background: activeAttention.length ? '#153c31' : '#e8f6ed', color: activeAttention.length ? '#fff' : '#17603a', fontSize: 12, fontWeight: 900 }}>{loading ? '…' : activeAttention.length}</span></div>{loading ? <p style={{ margin: 0, padding: '8px 20px 20px', color: '#75685a', fontSize: 13 }}>Checking your order queues…</p> : activeAttention.length ? <div className="gob-dashboard-attention" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: '1px solid #eee4d7' }}>{activeAttention.map(item => { const Icon = item.icon; return <Link key={item.label} href={item.href} style={{ padding: 16, borderRight: '1px solid #eee4d7', color: '#1a1008', textDecoration: 'none' }}><span style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: item.background, color: item.tone }}><Icon size={16} /></span><strong style={{ display: 'block', marginTop: 11, fontSize: 13 }}>{item.label} <span style={{ color: item.tone }}>{item.count}</span></strong><span style={{ display: 'block', marginTop: 4, color: '#75685a', fontSize: 12, lineHeight: 1.4 }}>{item.detail}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 11, color: item.tone, fontSize: 11, fontWeight: 900 }}>Review <ArrowRight size={13} /></span></Link> })}</div> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px 20px', color: '#17603a', fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={18} /> No active fulfilment, payment, address or delivery exceptions.</div>}</section>
    <div className="gob-dashboard-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, .9fr)', gap: 20 }}><RevenueChart points={data?.trend || []} /><section aria-labelledby="recent-orders-heading" style={{ ...panelStyle, overflow: 'hidden' }}><div style={panelHeaderStyle}><div><p style={eyebrowStyle}>Latest activity</p><h2 id="recent-orders-heading" style={sectionTitleStyle}>Recent orders</h2></div><Link href="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#9a6514', fontSize: 11, fontWeight: 900, textDecoration: 'none' }}>See all <ArrowRight size={13} /></Link></div><div style={{ borderTop: '1px solid #eee4d7' }}>{(data?.recent_orders || []).slice(0, 6).map(order => { const color = statusColors[order.status] || { foreground: '#635547', background: '#f2ede3' }; return <Link key={order.id} href="/orders" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, padding: '12px 18px', color: '#1a1008', textDecoration: 'none', borderBottom: '1px solid #f2ece2' }}><span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{order.ref}</strong><span style={{ display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#75685a', fontSize: 11 }}>{order.customer_name || order.customer_phone || 'Customer details pending'}</span></span><span style={{ textAlign: 'right' }}><strong style={{ display: 'block', fontSize: 12 }}>{money(order.total)}</strong><span style={{ display: 'inline-block', marginTop: 4, padding: '3px 6px', borderRadius: 9, color: color.foreground, background: color.background, fontSize: 9, fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase' }}>{order.status.replaceAll('_', ' ')}</span></span></Link> })}{!loading && !data?.recent_orders.length && <p style={{ margin: 0, padding: 20, color: '#75685a', fontSize: 13 }}>No orders yet.</p>}</div></section></div>
  </div>
}
