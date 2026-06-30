'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const SECTIONS = [
  {
    title: 'OVERVIEW',
    color: '#3b82f6',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: '📊', desc: "Today's sales, revenue, and pending orders" },
    ]
  },
  {
    title: 'ORDERS',
    color: '#f59e0b',
    items: [
      { name: 'All Orders', href: '/orders', icon: '📦', desc: 'View, filter, and manage all orders' },
      { name: 'Order Notes', href: '/order-notes', icon: '📝', desc: 'Internal notes on orders' },
      { name: 'COD Tracker', href: '/cod-tracker', icon: '💵', desc: 'Cash on delivery order management' },
      { name: 'Cancellations', href: '/cancellation-tracker', icon: '❌', desc: 'Track cancelled and returned orders' },
    ]
  },
  {
    title: 'SHIPPING',
    color: '#8b5cf6',
    items: [
      { name: 'Delhivery Sync', href: '/delhivery-sync', icon: '🔄', desc: 'Auto-sync order status from Delhivery' },
      { name: 'Delivery Estimator', href: '/delivery-estimator', icon: '📅', desc: 'Estimated delivery dates from Delhivery' },
      { name: 'Shipment Tracker', href: '/shipment-tracker', icon: '🚚', desc: 'Track all shipments in one place' },
    ]
  },
  {
    title: 'PRODUCTS',
    color: '#16a34a',
    items: [
      { name: 'Product Catalog', href: '/products', icon: '🦴', desc: 'All products with prices, stock, and images' },
      { name: 'Product Manager', href: '/product-manager', icon: '✏️', desc: 'Edit prices, MRP, sizes, and stock' },
      { name: 'Performance', href: '/product-performance', icon: '📈', desc: 'Sales, revenue, and ratings per product' },
      { name: 'Inventory', href: '/inventory', icon: '📋', desc: 'Current stock levels and reorder alerts' },
    ]
  },
  {
    title: 'CUSTOMERS',
    color: '#ec4899',
    items: [
      { name: 'All Customers', href: '/customers', icon: '👥', desc: 'Name, orders, lifetime value, contact info' },
      { name: 'Dog Birthday Club', href: '/dog-birthday-club', icon: '🎂', desc: 'Pet birthdays captured from website popup' },
      { name: 'Reorder Alerts', href: '/reorder-alerts', icon: '🔔', desc: 'Customers likely running low on treats' },
      { name: 'Abandoned Carts', href: '/abandoned-carts', icon: '🛒', desc: 'Recover carts that didn\'t convert' },
    ]
  },
  {
    title: 'CONTENT',
    color: '#06b6d4',
    items: [
      { name: 'Blogs', href: '/blogs', icon: '📝', desc: 'Create and manage blog articles' },
      { name: 'Dog Gallery', href: '/dog-gallery', icon: '📷', desc: 'Customer dog photos & videos for homepage' },
      { name: 'Strays We Feed', href: '/strays', icon: '🐕', desc: 'Manage stray dogs with multiple photos' },
      { name: 'Site Content', href: '/site-content', icon: '🖼️', desc: 'Hero images, infographics, banners' },
    ]
  },
  {
    title: 'MARKETING',
    color: '#f97316',
    items: [
      { name: 'Coupons', href: '/coupons', icon: '🏷️', desc: 'Manage discount codes and promotions' },
      { name: 'Referrals', href: '/referrals', icon: '🤝', desc: 'Track referral signups and rewards' },
      { name: 'Email Captures', href: '/email-captures', icon: '📧', desc: 'Emails collected from spin wheel & popups' },
    ]
  },
  {
    title: 'ANALYTICS',
    color: '#6366f1',
    items: [
      { name: 'Overview', href: '/analytics', icon: '📊', desc: 'Revenue trends, conversion rates, AOV' },
      { name: 'City Heatmap', href: '/city-heatmap', icon: '🗺️', desc: 'Order volume by city and region' },
    ]
  },
  {
    title: 'FINANCE',
    color: '#84cc16',
    items: [
      { name: 'Finance', href: '/finance', icon: '💰', desc: 'Revenue, margins, and P&L overview' },
      { name: 'Expenses', href: '/expenses', icon: '💸', desc: 'Track business expenses by category' },
      { name: 'Razorpay', href: '/razorpay', icon: '💳', desc: 'Payment settlements and transactions' },
      { name: 'Invoices', href: '/invoices', icon: '🧾', desc: 'Generate and view individual invoices' },
    ]
  },
  {
    title: 'OPERATIONS',
    color: '#78716c',
    items: [
      { name: 'Tasks', href: '/tasks', icon: '✅', desc: 'To-do list for the team' },
      { name: 'Team Access', href: '/team-access', icon: '👤', desc: 'Manage team member roles and access' },
      { name: 'Activity Log', href: '/activity-log', icon: '📋', desc: 'Log of all admin actions' },
      { name: 'Audit Trail', href: '/audit-trail', icon: '🔍', desc: 'Detailed change history for orders' },
    ]
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.title, true]))
  );

  function toggleSection(title: string) {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside style={{
      width: collapsed ? 60 : 240,
      minHeight: '100vh',
      background: '#1a1008',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width .2s',
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/logo.jpeg" 
          style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} alt="Logo" />
        {!collapsed && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#c8973a' }}>Game of Bones</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Admin Panel</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} 
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Sections */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 4 }}>
            {/* Section header */}
            <button onClick={() => toggleSection(section.title)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: collapsed ? '8px 20px' : '8px 14px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: section.color, flexShrink: 0 }} />
              {!collapsed && (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', flex: 1 }}>
                    {section.title}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', transition: 'transform .2s', transform: openSections[section.title] ? 'rotate(0)' : 'rotate(-90deg)' }}>▼</span>
                </>
              )}
            </button>

            {/* Section items */}
            {openSections[section.title] && !collapsed && (
              <div style={{ marginBottom: 8 }}>
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px 8px 28px',
                        background: isActive ? 'rgba(200,151,58,.15)' : 'transparent',
                        borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#c8973a' : 'rgba(255,255,255,.8)', lineHeight: 1.3 }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Collapsed mode: show icons only */}
            {collapsed && openSections[section.title] && section.items.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={item.name}>
                  <div style={{
                    padding: '6px 0', textAlign: 'center', fontSize: 16,
                    background: isActive ? 'rgba(200,151,58,.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent',
                  }}>
                    {item.icon}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 10, color: 'rgba(255,255,255,.2)' }}>
          Game of Bones Admin
          <br />gameofbones@gmail.com
        </div>
      )}
    </aside>
  );
}
