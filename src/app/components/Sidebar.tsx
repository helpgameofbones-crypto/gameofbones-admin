'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  icon: string
  label: string
  href: string
  desc: string
}

interface NavGroup {
  title: string
  color: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    color: '#c8973a',
    items: [
      { icon: '📊', label: 'Dashboard', href: '/dashboard', desc: 'Today\'s sales, revenue, and pending orders at a glance' },
    ],
  },
  {
    title: 'Orders',
    color: '#e67e22',
    items: [
      { icon: '🛒', label: 'All Orders', href: '/orders', desc: 'View, search, and update order statuses' },
      { icon: '✏️', label: 'Create Order', href: '/manual-order', desc: 'Manually place an order for a customer' },
      { icon: '📝', label: 'Order Notes', href: '/order-notes', desc: 'Internal notes attached to orders' },
      { icon: '📋', label: 'Order Timeline', href: '/order-timeline', desc: 'Visual status history of each order' },
      { icon: '📞', label: 'COD Tracker', href: '/cod-tracker', desc: 'Track cash-on-delivery confirmations' },
      { icon: '❌', label: 'Cancellations', href: '/cancellation-tracker', desc: 'Monitor cancelled orders and reasons' },
      { icon: '⚠️', label: 'Duplicate Orders', href: '/duplicate-orders', desc: 'Flag potential duplicate submissions' },
    ],
  },
  {
    title: 'Shipping',
    color: '#3498db',
    items: [
      { icon: '🚚', label: 'Delhivery', href: '/delhivery', desc: 'Manage shipments, AWBs, and pickup requests' },
      { icon: '📅', label: 'Delivery Estimator', href: '/delivery-estimator', desc: 'Estimated delivery dates by pincode zone' },
      { icon: '🚨', label: 'RTO', href: '/rto', desc: 'Return-to-origin shipments and recovery' },
      { icon: '📥', label: 'Returns', href: '/returns', desc: 'Customer return requests and refund status' },
      { icon: '↩️', label: 'Refund Tracker', href: '/refund-tracker', desc: 'Track refund amounts and processing' },
    ],
  },
  {
    title: 'Products',
    color: '#2ecc71',
    items: [
      { icon: '📦', label: 'Product Catalog', href: '/products', desc: 'All products with prices, stock, and images' },
      { icon: '🏭', label: 'Product Manager', href: '/product-management', desc: 'Add, edit, or archive products and sizes' },
      { icon: '📊', label: 'Performance', href: '/product-performance', desc: 'Sales, revenue, and ratings per product' },
      { icon: '🔗', label: 'Affinity', href: '/product-affinity', desc: 'Which products are bought together' },
      { icon: '📋', label: 'Inventory', href: '/inventory', desc: 'Current stock levels and reorder alerts' },
      { icon: '⚙️', label: 'Production', href: '/production', desc: 'Batch records, yield tracking, and costs' },
    ],
  },
  {
    title: 'Customers',
    color: '#9b59b6',
    items: [
      { icon: '👥', label: 'All Customers', href: '/customers', desc: 'Customer list with order history and value' },
      { icon: '🧠', label: 'Intelligence', href: '/customer-intelligence', desc: 'Segments, lifetime value, and churn risk' },
      { icon: '🐶', label: 'Dog Birthdays', href: '/dog-birthday-info', desc: 'Upcoming birthdays for marketing outreach' },
      { icon: '📧', label: 'Email Captures', href: '/email-captures', desc: 'Emails from spin wheel, newsletter, popups' },
      { icon: '🛑', label: 'Abandoned Carts', href: '/abandoned-carts', desc: 'Carts that didn\'t convert — recovery targets' },
      { icon: '⭐', label: 'NPS Surveys', href: '/nps', desc: 'Net Promoter Score feedback from customers' },
    ],
  },
  {
    title: 'Marketing',
    color: '#e74c3c',
    items: [
      { icon: '🏷️', label: 'Coupons', href: '/coupons', desc: 'Create and manage discount codes' },
      { icon: '📢', label: 'Campaigns', href: '/campaigns', desc: 'Email and SMS campaign management' },
      { icon: '🎨', label: 'Campaign Hub', href: '/campaigns-hub', desc: 'Multi-channel campaign planner' },
      { icon: '🎁', label: 'Promotions', href: '/promotions', desc: 'Flash sales, bundles, and special offers' },
      { icon: '🖼️', label: 'Banners', href: '/banners', desc: 'Homepage and category banner management' },
      { icon: '📧', label: 'Marketing', href: '/marketing', desc: 'UTM links, ad spend, and attribution' },
      { icon: '🎮', label: 'Gamification', href: '/gamification', desc: 'Spin wheel prizes, milestones, and streaks' },
      { icon: '💎', label: 'Loyalty', href: '/loyalty', desc: 'Points earned per customer, manual adjustments' },
      { icon: '🔄', label: 'Reorder Alerts', href: '/reorder-alert', desc: 'Remind customers when treats run low' },
      { icon: '📰', label: 'Blog Articles', href: '/blogs', desc: 'Create, edit, and publish blog posts' },
    ],
  },
  {
    title: 'Analytics',
    color: '#1abc9c',
    items: [
      { icon: '📈', label: 'Overview', href: '/analytics', desc: 'Revenue trends, conversion rates, and traffic' },
      { icon: '🎯', label: 'Advanced', href: '/analytics-advanced', desc: 'Deep-dive: funnel analysis, AOV trends' },
      { icon: '🎓', label: 'Cohort Analysis', href: '/cohort-analysis', desc: 'Retention and repeat purchase by cohort' },
      { icon: '🗺️', label: 'City Heatmap', href: '/city-heatmap', desc: 'Order volume by city and region' },
      { icon: '⏰', label: 'Hour Analysis', href: '/hour-analysis', desc: 'Peak ordering times and day-of-week patterns' },
    ],
  },
  {
    title: 'Finance',
    color: '#f39c12',
    items: [
      { icon: '💳', label: 'Finance', href: '/finance', desc: 'Revenue, margins, and P&L overview' },
      { icon: '💵', label: 'Expenses', href: '/expenses', desc: 'Track business expenses by category' },
      { icon: '💰', label: 'Razorpay', href: '/razorpay', desc: 'Payment settlements and transaction logs' },
      { icon: '🧾', label: 'Invoices', href: '/invoices', desc: 'Generate and view individual invoices' },
      { icon: '📄', label: 'Bulk Invoices', href: '/bulk-invoices', desc: 'Generate invoices for a date range' },
      { icon: '📤', label: 'Bulk Export', href: '/bulk-export', desc: 'Export orders, customers, or products as CSV' },
    ],
  },
  {
    title: 'Operations',
    color: '#7f8c8d',
    items: [
      { icon: '⚙️', label: 'Operations', href: '/operations', desc: 'Daily ops checklist and workflow status' },
      { icon: '✅', label: 'Tasks', href: '/tasks', desc: 'To-do list for the team' },
      { icon: '👨‍💼', label: 'Team Access', href: '/team-access', desc: 'Manage team member roles and permissions' },
      { icon: '🔔', label: 'Notifications', href: '/notifications', desc: 'System alerts and order notifications' },
      { icon: '📊', label: 'Activity Log', href: '/activity', desc: 'Audit trail of all admin actions' },
      { icon: '✏️', label: 'Audit Trail', href: '/audit-trail', desc: 'Detailed change history for compliance' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  // Auto-open the section containing the current page
  useEffect(() => {
    const initial: Record<string, boolean> = {}
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + '/')
      )
      initial[group.title] = hasActive || group.title === 'Overview'
    })
    setOpenSections(initial)
  }, [pathname])

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  if (pathname === '/login') return null

  return (
    <aside
      style={{
        width: collapsed ? '68px' : '264px',
        background: '#1a1008',
        color: '#fff',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.25s ease',
        borderRight: '1px solid #2d2418',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: collapsed ? '20px 12px' : '20px 18px',
          borderBottom: '1px solid #2d2418',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🐾</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#c8973a', letterSpacing: '.04em' }}>
                Game of Bones
              </div>
              <div style={{ fontSize: '10px', color: '#6b5d4f', fontWeight: '500', letterSpacing: '.06em' }}>
                ADMIN PANEL
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: '1px solid #2d2418',
            color: '#6b5d4f',
            cursor: 'pointer',
            fontSize: '14px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: collapsed ? '8px 6px' : '8px 10px', overflowY: 'auto' }}>
        {NAV_GROUPS.map((group) => {
          const isOpen = openSections[group.title] ?? false
          const hasActive = group.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + '/')
          )

          return (
            <div key={group.title} style={{ marginBottom: '4px' }}>
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(group.title)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 10px',
                    margin: '4px 0 2px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: hasActive ? group.color : '#6b5d4f',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase' as const,
                    textAlign: 'left' as const,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: hasActive ? group.color : '#3d3028',
                        flexShrink: 0,
                      }}
                    />
                    {group.title}
                  </span>
                  <span
                    style={{
                      fontSize: '8px',
                      transition: 'transform 0.2s',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  >
                    ▸
                  </span>
                </button>
              )}

              {/* Section items */}
              {(isOpen || collapsed) &&
                group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? `${item.label}: ${item.desc}` : item.desc}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: collapsed ? '10px 8px' : '8px 10px 8px 22px',
                        marginBottom: '1px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        color: isActive ? '#fff' : '#8a7d6f',
                        background: isActive ? 'rgba(200, 151, 58, 0.12)' : 'transparent',
                        borderLeft: isActive
                          ? `2px solid ${group.color}`
                          : '2px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: collapsed ? '18px' : '14px',
                          minWidth: '20px',
                          textAlign: 'center' as const,
                          lineHeight: '20px',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: isActive ? '600' : '500',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '20px',
                              color: isActive ? '#fff' : '#b5a99a',
                            }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#5a5048',
                              lineHeight: '14px',
                              marginTop: '2px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.desc}
                          </div>
                        </div>
                      )}
                    </Link>
                  )
                })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div
          style={{
            padding: '16px 18px',
            borderTop: '1px solid #2d2418',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '10px', color: '#4a3f34', lineHeight: '1.5' }}>
            Game of Bones Admin
          </div>
          <div style={{ fontSize: '9px', color: '#3a3028' }}>
            helpgameofbones@gmail.com
          </div>
        </div>
      )}
    </aside>
  )
}
