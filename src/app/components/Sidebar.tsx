'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const allPages = [
  { label: 'Abandoned Carts',   href: '/abandoned-carts',       icon: '🛒' },
  { label: 'Activity Log',      href: '/activity',              icon: '📝' },
  { label: 'Adv Analytics',     href: '/analytics-advanced',    icon: '🔥' },
  { label: 'Analytics',         href: '/analytics',             icon: '📊' },
  { label: 'Audit Trail',       href: '/audit-trail',           icon: '🛡️' },
  { label: 'Banners',           href: '/banners',               icon: '🖼️' },
  { label: 'Bulk Export',       href: '/bulk-export',           icon: '📤' },
  { label: 'Bulk Invoices',     href: '/bulk-invoices',         icon: '📦' },
  { label: 'Campaigns',         href: '/campaigns',             icon: '📢' },
  { label: 'Campaigns+',        href: '/campaigns-hub',         icon: '🪔' },
  { label: 'Cancellations',     href: '/cancellation-tracker',  icon: '❌' },
  { label: 'City Heatmap',      href: '/city-heatmap',          icon: '🗺️' },
  { label: 'COD Tracker',       href: '/cod-tracker',           icon: '📞' },
  { label: 'Cohort Analysis',   href: '/cohort-analysis',       icon: '📊' },
  { label: 'Coupons',           href: '/coupons',               icon: '🏷️' },
  { label: 'Cust Intel',        href: '/customer-intelligence', icon: '🧠' },
  { label: 'Customers',         href: '/customers',             icon: '👤' },
  { label: 'Dashboard',         href: '/dashboard',             icon: '🏠' },
  { label: 'Delhivery',         href: '/delhivery',             icon: '🚚' },
  { label: 'Delivery Est.',     href: '/delivery-estimator',    icon: '📅' },
  { label: 'Duplicate Orders',  href: '/duplicate-orders',      icon: '⚠️' },
  { label: 'Expenses',          href: '/expenses',              icon: '💸' },
  { label: 'Finance',           href: '/finance',               icon: '💰' },
  { label: 'Gamification',      href: '/gamification',          icon: '🎡' },
  { label: 'Hour Analysis',     href: '/hour-analysis',         icon: '🕐' },
  { label: 'Inventory',         href: '/inventory',             icon: '📋' },
  { label: 'Invoices',          href: '/invoices',              icon: '🧾' },
  { label: 'Loyalty',           href: '/loyalty',               icon: '⭐' },
  { label: 'Marketing',         href: '/marketing',             icon: '📡' },
  { label: 'Notifications',     href: '/notifications',         icon: '🔔' },
  { label: 'NPS Survey',        href: '/nps',                   icon: '⭐' },
  { label: 'Operations',        href: '/operations',            icon: '🏭' },
  { label: 'Order Notes',       href: '/order-notes',           icon: '📝' },
  { label: 'Order Timeline',    href: '/order-timeline',        icon: '⏱️' },
  { label: 'Orders',            href: '/orders',                icon: '📦' },
  { label: 'Product Affinity',  href: '/product-affinity',      icon: '🔗' },
  { label: 'Product Mgmt',      href: '/product-management',    icon: '🦴' },
  { label: 'Production',        href: '/production',            icon: '🏭' },
  { label: 'Products',          href: '/products',              icon: '🦴' },
  { label: 'Promotions',        href: '/promotions',            icon: '⚡' },
  { label: 'Razorpay',          href: '/razorpay',              icon: '💳' },
  { label: 'Refund Tracker',    href: '/refund-tracker',        icon: '💸' },
  { label: 'Reorder Alerts',    href: '/reorder-alerts',        icon: '🔔' },
  { label: 'Returns',           href: '/returns',               icon: '↩️' },
  { label: 'RTO Risk',          href: '/rto',                   icon: '↩️' },
  { label: 'Tasks',             href: '/tasks',                 icon: '✅' },
  { label: 'Team Access',       href: '/team-access',           icon: '👥' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = allPages.filter(p =>
    !search || p.label.toLowerCase().includes(search.toLowerCase())
  )

  if (pathname === '/login') return null

  return (
    <aside
      style={{
        width: collapsed ? '60px' : '220px',
        minHeight: '100vh',
        background: '#1a1008',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🐾</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#c8973a' }}>Game of Bones</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Admin Panel</div>
            </div>
          </div>
        )}
        {collapsed && <span style={{ fontSize: 20, margin: '0 auto' }}>🐾</span>}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div style={{ padding: '10px 12px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pages..."
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              color: 'white',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Nav Links */}
      <nav style={{ flex: 1, padding: '4px 0', overflowY: 'auto' }}>
        {filtered.map(page => {
          const isActive = pathname === page.href
          return (
            <Link
              key={page.href}
              href={page.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '9px 0' : '8px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                background: isActive ? 'rgba(200,151,58,0.2)' : 'transparent',
                borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
              title={collapsed ? page.label : undefined}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{page.icon}</span>
              {!collapsed && (
                <span style={{
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#c8973a' : 'rgba(255,255,255,0.75)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {page.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
          v2.0 · 67 pages
        </div>
      )}
    </aside>
  )
}