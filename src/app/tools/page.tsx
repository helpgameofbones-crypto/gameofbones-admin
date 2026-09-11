'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type Tool = { name: string; href: string; description: string }
type ToolGroup = { name: string; description: string; tools: Tool[] }

const groups: ToolGroup[] = [
  { name: 'Orders & fulfilment', description: 'Take orders, ship them, and resolve delivery issues.', tools: [
    { name: 'Orders', href: '/orders', description: 'Order queue, status and customer details' },
    { name: 'Manual order', href: '/manual-order', description: 'Phone, walk-in and offline orders' },
    { name: 'Fulfilment', href: '/delhivery', description: 'Dispatch and Delhivery operations' },
    { name: 'Shipment tracking', href: '/shipment-tracker', description: 'Tracking and delivery status' },
    { name: 'COD & exceptions', href: '/cod-tracker', description: 'COD checks, cancellation and duplicates' },
    { name: 'Returns & RTO', href: '/returns', description: 'Returns, refunds and RTO recovery' },
    { name: 'Refund tracker', href: '/refund-tracker', description: 'Refund progress and payment follow-up' },
    { name: 'Cancellation tracker', href: '/cancellation-tracker', description: 'Cancellation reasons and prevention' },
    { name: 'Duplicate orders', href: '/duplicate-orders', description: 'Review possible duplicate orders' },
    { name: 'Order notes', href: '/order-notes', description: 'Internal notes and customer context' },
    { name: 'Order timeline', href: '/order-timeline', description: 'Order lifecycle and handoffs' },
    { name: 'Delivery estimator', href: '/delivery-estimator', description: 'Delivery ETA tools' },
  ] },
  { name: 'Products & operations', description: 'Catalogue, stock, batches and production.', tools: [
    { name: 'Products', href: '/products', description: 'Products, pricing, images and stock' },
    { name: 'Inventory', href: '/inventory', description: 'Stock, batches and production work' },
    { name: 'Production', href: '/production', description: 'Production planning and batch work' },
    { name: 'Reorder alerts', href: '/reorder-alert', description: 'Items that need replenishment' },
    { name: 'Product performance', href: '/product-performance', description: 'Best sellers and product performance' },
    { name: 'Product affinity', href: '/product-affinity', description: 'Products purchased together' },
    { name: 'Promotions', href: '/promotions', description: 'Promotional products and offers' },
    { name: 'Banners', href: '/banners', description: 'Storefront banners and offers' },
    { name: 'Site content', href: '/site-content', description: 'Storefront copy, blogs and social proof' },
    { name: 'Blogs', href: '/blogs', description: 'Journal articles and content' },
    { name: 'Operations', href: '/operations', description: 'Operational planning and workflows' },
  ] },
  { name: 'Customers & loyalty', description: 'Customer profiles, retention, rewards and feedback.', tools: [
    { name: 'Customers', href: '/customers', description: 'Customer profiles, purchases and details' },
    { name: 'Customer intelligence', href: '/customer-intelligence', description: 'Segments, retention and customer value' },
    { name: 'Loyalty & rewards', href: '/loyalty', description: 'Points and reward activity' },
    { name: 'Loyalty & recovery', href: '/gamification', description: 'Rewards, birthdays, carts and referrals' },
    { name: 'Referrals', href: '/referrals', description: 'Referral rewards and performance' },
    { name: 'Spin & leads', href: '/email-captures', description: 'Spin-to-win and email leads' },
    { name: 'Review approval', href: '/reviews', description: 'Approve reviews and award points' },
    { name: 'Enquiries', href: '/contact-inquiries', description: 'Customer contact-form messages' },
    { name: 'NPS feedback', href: '/nps', description: 'Customer satisfaction and feedback' },
    { name: 'Birthday tools', href: '/birthday', description: 'Birthday customers and offers' },
    { name: 'Dog birthday club', href: '/dog-birthday-club', description: 'Dog birthdays and campaigns' },
    { name: 'Dog gallery', href: '/dog-gallery', description: 'Customer pet gallery' },
    { name: 'Stray support', href: '/strays', description: 'Stray-support administration' },
  ] },
  { name: 'Growth & marketing', description: 'Spend, campaigns, offers and recovery.', tools: [
    { name: 'Marketing & ad spend', href: '/marketing', description: 'Meta spend, ROAS, pixels and UTM links' },
    { name: 'Campaign setup', href: '/campaigns', description: 'Build segments and send campaigns' },
    { name: 'Campaign hub', href: '/campaigns-hub', description: 'Seasonal and operational campaigns' },
    { name: 'Coupons', href: '/coupons', description: 'Create, manage and audit coupons' },
    { name: 'Cart recovery', href: '/abandoned-carts', description: 'Abandoned carts and recovery workflow' },
    { name: 'Influencers', href: '/influencers', description: 'Influencer marketing activity' },
  ] },
  { name: 'Finance & reporting', description: 'Revenue, payments, costs, exports and insights.', tools: [
    { name: 'Finance', href: '/finance', description: 'Revenue, margin, payments and COGS' },
    { name: 'Razorpay payments', href: '/razorpay', description: 'Payments, refunds and settlements' },
    { name: 'Expenses', href: '/expenses', description: 'Operating costs and expense records' },
    { name: 'Invoices', href: '/invoices', description: 'Customer invoices and documents' },
    { name: 'Bulk invoices', href: '/bulk-invoices', description: 'Create invoices in bulk' },
    { name: 'Bulk export', href: '/bulk-export', description: 'Export operating and customer data' },
    { name: 'Insights', href: '/analytics', description: 'Revenue and performance analytics' },
    { name: 'Advanced analytics', href: '/analytics-advanced', description: 'Deep analysis and reporting' },
    { name: 'Cohort analysis', href: '/cohort-analysis', description: 'Repeat purchase and cohort behaviour' },
    { name: 'City analysis', href: '/city-heatmap', description: 'Geographic order performance' },
    { name: 'Hourly analysis', href: '/hour-analysis', description: 'Order timing and demand patterns' },
  ] },
  { name: 'Administration', description: 'Team, tasks, activity and platform controls.', tools: [
    { name: 'Today & tasks', href: '/tasks', description: 'Daily checklist and admin overview' },
    { name: 'Activity log', href: '/activity', description: 'Recent admin activity' },
    { name: 'Audit trail', href: '/audit-trail', description: 'Changes and accountability' },
    { name: 'Team access', href: '/team-access', description: 'Team members and permissions' },
    { name: 'Notifications', href: '/notifications', description: 'Administrative notifications' },
    { name: 'Delhivery sync', href: '/delhivery-sync', description: 'Delivery-data sync controls' },
  ] },
]

export default function ToolsPage() {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const visibleGroups = useMemo(() => groups.map(group => ({ ...group, tools: group.tools.filter(tool => !normalized || `${tool.name} ${tool.description}`.toLowerCase().includes(normalized)) })).filter(group => group.tools.length), [normalized])

  return <main style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 28px 60px' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 20, alignItems: 'end', paddingBottom: 20, borderBottom: '1px solid #e6dccb' }}>
      <div><p style={{ margin: '0 0 5px', color: '#9a6514', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>Complete admin directory</p><h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 32, letterSpacing: '-.04em' }}>All tools, in one place</h1><p style={{ margin: '8px 0 0', color: '#746759', maxWidth: 650, lineHeight: 1.45 }}>Nothing is hidden or removed. Search every available operational, customer, marketing and finance tool.</p></div>
      <label style={{ display: 'grid', gap: 6, width: 'min(100%, 360px)', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#746759' }}>Find a tool<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Orders, Meta spend, refund…" style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '0 12px', border: '1px solid #cfc1ae', background: '#fffdf9', color: '#1a1008', font: '600 14px system-ui', textTransform: 'none', letterSpacing: 0 }} /></label>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 18, marginTop: 24 }}>
      {visibleGroups.map(group => <section key={group.name} style={{ background: '#fffdf9', border: '1px solid #dfd3c1', boxShadow: '0 8px 24px rgba(59,37,12,.04)' }}><div style={{ padding: '15px 16px 12px', borderBottom: '1px solid #eee4d7' }}><h2 style={{ margin: 0, fontSize: 15 }}>{group.name}</h2><p style={{ margin: '4px 0 0', color: '#746759', fontSize: 12 }}>{group.description}</p></div><div>{group.tools.map(tool => <Link key={tool.href} href={tool.href} style={{ display: 'block', padding: '11px 16px', borderBottom: '1px solid #f2eadf', textDecoration: 'none', color: '#1a1008' }}><strong style={{ display: 'block', fontSize: 13 }}>{tool.name} →</strong><span style={{ display: 'block', marginTop: 2, color: '#746759', fontSize: 11 }}>{tool.description}</span></Link>)}</div></section>)}
    </div>
    {!visibleGroups.length && <p style={{ padding: 28, textAlign: 'center', color: '#746759' }}>No tool matched “{query}”.</p>}
  </main>
}
