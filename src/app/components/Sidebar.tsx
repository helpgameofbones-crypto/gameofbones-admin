'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { icon: '💬', label: 'Abandoned Carts', href: '/abandoned-carts' },
    { icon: '📊', label: 'Activity', href: '/activity' },
    { icon: '📈', label: 'Analytics', href: '/analytics' },
    { icon: '🎯', label: 'Analytics Advanced', href: '/analytics-advanced' },
    { icon: '✏️', label: 'Audit Trail', href: '/audit-trail' },
    { icon: '🏷️', label: 'Banners', href: '/banners' },
    { icon: '📤', label: 'Bulk Export', href: '/bulk-export' },
    { icon: '📄', label: 'Bulk Invoices', href: '/bulk-invoices' },
    { icon: '📢', label: 'Campaigns', href: '/campaigns' },
    { icon: '🎨', label: 'Campaigns+', href: '/campaigns-hub' },
    { icon: '💰', label: 'Cashflow', href: '/cashflow' },
    { icon: '❌', label: 'Cancellations', href: '/cancellation-tracker' },
    { icon: '🗺️', label: 'City Heatmap', href: '/city-heatmap' },
    { icon: '📞', label: 'COD Tracker', href: '/cod-tracker' },
    { icon: '🎓', label: 'Cohort Analysis', href: '/cohort-analysis' },
    { icon: '🏷️', label: 'Coupons', href: '/coupons' },
    { icon: '👤', label: 'Cust Intel', href: '/customer-intelligence' },
    { icon: '👥', label: 'Customers', href: '/customers' },
    { icon: '🏠', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚚', label: 'Delhivery', href: '/delhivery' },
    { icon: '📅', label: 'Delivery Est.', href: '/delivery-estimator' },
    { icon: '⚠️', label: 'Duplicate Orders', href: '/duplicate-orders' },
    { icon: '💵', label: 'Expenses', href: '/expenses' },
    { icon: '💳', label: 'Finance', href: '/finance' },
    { icon: '🎮', label: 'Gamification', href: '/gamification' },
    { icon: '⏰', label: 'Hour Analysis', href: '/hour-analysis' },
    { icon: '📦', label: 'Inventory', href: '/inventory' },
    { icon: '🧾', label: 'Invoices', href: '/invoices' },
    { icon: '🔓', label: 'Login', href: '/login' },
    { icon: '💎', label: 'Loyalty', href: '/loyalty' },
    { icon: '📧', label: 'Marketing', href: '/marketing' },
    { icon: '🔔', label: 'Notifications', href: '/notifications' },
    { icon: '⭐', label: 'NPS', href: '/nps' },
    { icon: '⚙️', label: 'Operations', href: '/operations' },
    { icon: '📝', label: 'Order Notes', href: '/order-notes' },
    { icon: '📋', label: 'Order Timeline', href: '/order-timeline' },
    { icon: '🛒', label: 'Orders', href: '/orders' },
    { icon: '🔗', label: 'Product Affinity', href: '/product-affinity' },
    { icon: '🏭', label: 'Product Management', href: '/product-management' },
    { icon: '📈', label: 'Product Performance', href: '/product-performance' },
    { icon: '⚙️', label: 'Production', href: '/production' },
    { icon: '📦', label: 'Products', href: '/products' },
    { icon: '🎁', label: 'Promotions', href: '/promotions' },
    { icon: '💳', label: 'Razorpay', href: '/razorpay' },
    { icon: '↩️', label: 'Refund Tracker', href: '/refund-tracker' },
    { icon: '🔄', label: 'Reorder Alert', href: '/reorder-alert' },
    { icon: '📥', label: 'Returns', href: '/returns' },
    { icon: '🚨', label: 'RTO', href: '/rto' },
    { icon: '✅', label: 'Tasks', href: '/tasks' },
    { icon: '👨‍💼', label: 'Team Access', href: '/team-access' },
  ]

  return (
    <aside style={{ width: collapsed ? '80px' : '280px', background: '#1a1008', color: '#fff', padding: '20px 0', overflowY: 'auto', transition: 'width 0.3s ease', borderRight: '1px solid #3d2b1f', height: '100vh', position: 'sticky', top: 0, left: 0 }}>
      <div style={{ padding: '0 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '24px' }}>🐾</span>
          {!collapsed && <span style={{ fontSize: '14px', fontWeight: '600', color: '#c8973a' }}>GoB</span>}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: '#c8973a', cursor: 'pointer', fontSize: '16px' }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>
      <nav style={{ padding: '0 8px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 12px', marginBottom: '4px', borderRadius: '8px', textDecoration: 'none', color: isActive ? '#c8973a' : '#a89a84', background: isActive ? 'rgba(200, 151, 58, 0.1)' : 'transparent', transition: 'all 0.2s ease', borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent' }}>
              <span style={{ fontSize: '18px', minWidth: '24px', textAlign: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

