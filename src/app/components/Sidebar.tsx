'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const SECTIONS = [
  { title: 'OVERVIEW', color: '#3b82f6', items: [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', desc: "Today's sales, revenue, and pending orders" },
  ]},
  { title: 'ORDERS', color: '#f59e0b', items: [
    { name: 'All Orders', href: '/orders', icon: '📦', desc: 'View, filter, and manage all orders' },
    { name: 'Order Notes', href: '/order-notes', icon: '📝', desc: 'Internal notes on orders' },
    { name: 'COD Tracker', href: '/cod-tracker', icon: '💵', desc: 'Cash on delivery order management' },
    { name: 'Cancellations', href: '/cancellation-tracker', icon: '❌', desc: 'Track cancelled and returned orders' },
  ]},
  { title: 'SHIPPING', color: '#8b5cf6', items: [
    { name: 'Delhivery Sync', href: '/delhivery-sync', icon: '🔄', desc: 'Auto-sync order status from Delhivery' },
    { name: 'Delivery Estimator', href: '/delivery-estimator', icon: '📅', desc: 'Estimated delivery dates from Delhivery' },
    { name: 'Shipment Tracker', href: '/shipment-tracker', icon: '🚚', desc: 'Track all shipments in one place' },
  ]},
  { title: 'PRODUCTS', color: '#16a34a', items: [
    { name: 'Product Catalog', href: '/products', icon: '🦴', desc: 'All products with prices, MRP, stock, and images' },
    { name: 'Performance', href: '/product-performance', icon: '📈', desc: 'Sales, revenue, and ratings per product' },
    { name: 'Inventory', href: '/inventory', icon: '📋', desc: 'Current stock levels and reorder alerts' },
  ]},
  { title: 'CUSTOMERS', color: '#ec4899', items: [
    { name: 'All Customers', href: '/customers', icon: '👥', desc: 'Name, orders, lifetime value, contact info' },
    { name: 'Dog Birthday Club', href: '/dog-birthday-club', icon: '🎂', desc: 'Pet birthdays captured from website popup' },
    { name: 'Reorder Alerts', href: '/reorder-alert', icon: '🔔', desc: 'Customers likely running low on treats' },
    { name: 'Abandoned Carts', href: '/abandoned-carts', icon: '🛒', desc: "Recover carts that didn't convert" },
  ]},
  { title: 'CONTENT', color: '#06b6d4', items: [
    { name: 'Blogs', href: '/blogs', icon: '📝', desc: 'Create and manage blog articles' },
    { name: 'Dog Gallery', href: '/dog-gallery', icon: '📷', desc: 'Customer dog photos & videos for homepage' },
    { name: 'Strays We Feed', href: '/strays', icon: '🐕', desc: 'Manage stray dogs with multiple photos' },
    { name: 'Site Content', href: '/site-content', icon: '🖼️', desc: 'Hero images, infographics, banners' },
  ]},
  { title: 'MARKETING', color: '#f97316', items: [
    { name: 'Coupons', href: '/coupons', icon: '🏷️', desc: 'Manage discount codes and promotions' },
    { name: 'Referrals', href: '/referrals', icon: '🤝', desc: 'Track referral signups and rewards' },
    { name: 'Email Captures', href: '/email-captures', icon: '📧', desc: 'Emails collected from spin wheel & popups' },
  ]},
  { title: 'ANALYTICS', color: '#6366f1', items: [
    { name: 'Overview', href: '/analytics', icon: '📊', desc: 'Revenue trends, conversion rates, AOV' },
    { name: 'City Heatmap', href: '/city-heatmap', icon: '🗺️', desc: 'Order volume by city and region' },
  ]},
  { title: 'FINANCE', color: '#84cc16', items: [
    { name: 'Finance', href: '/finance', icon: '💰', desc: 'Revenue, margins, and P&L overview' },
    { name: 'Expenses', href: '/expenses', icon: '💸', desc: 'Track business expenses by category' },
    { name: 'Razorpay', href: '/razorpay', icon: '💳', desc: 'Payment settlements and transactions' },
    { name: 'Invoices', href: '/invoices', icon: '🧾', desc: 'Generate and view individual invoices' },
  ]},
  { title: 'OPERATIONS', color: '#78716c', items: [
    { name: 'Tasks', href: '/tasks', icon: '✅', desc: 'To-do list for the team' },
    { name: 'Team Access', href: '/team-access', icon: '👤', desc: 'Manage team member roles and access' },
    { name: 'Activity Log', href: '/activity', icon: '📋', desc: 'Log of all admin actions' },
    { name: 'Audit Trail', href: '/audit-trail', icon: '🔍', desc: 'Detailed change history for orders' },
  ]},
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 60;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.title, true]))
  );
  const asideRef = useRef<HTMLElement>(null);
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Click outside → collapse. Uses capture phase + a tiny delay-free check so it
  // reliably fires even when the click target is inside portals/dropdowns elsewhere on the page.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (collapsed) return;
      const el = asideRef.current;
      if (el && !el.contains(e.target as Node)) {
        setCollapsed(true);
      }
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [collapsed]);

  function toggleSection(title: string) {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  }

  // Injects a plain <style> tag into <head> and keeps it in sync with the
  // current sidebar width. Avoids styled-jsx entirely so it works regardless
  // of build tool (Turbopack/webpack) — just plain DOM APIs.
  useEffect(() => {
    let styleEl = document.getElementById('gob-sidebar-shift-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gob-sidebar-shift-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      body { margin: 0; }
      body.gob-admin-content-shift {
        margin-left: ${width}px !important;
        transition: margin-left .2s ease;
        min-height: 100vh;
      }
    `;
  }, [width]);

  return (
    <>
      <aside
        ref={asideRef}
        style={{
          width, minHeight: '100vh', background: '#1a1008', color: '#fff',
          display: 'flex', flexDirection: 'column', transition: 'width .2s ease',
          overflowY: 'auto', overflowX: 'hidden', position: 'fixed',
          left: 0, top: 0, bottom: 0, zIndex: 1000, flexShrink: 0,
          boxShadow: '2px 0 8px rgba(0,0,0,.15)',
        }}
      >
        {/* Header with hamburger toggle */}
        <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            aria-label="Toggle sidebar"
            style={{
              background: 'rgba(255,255,255,.08)', border: 'none', color: '#fff', cursor: 'pointer',
              width: 32, height: 32, borderRadius: 6, flexShrink: 0, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ☰
          </button>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/logo.jpeg"
                style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} alt="Logo" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c8973a', lineHeight: 1.2 }}>Game of Bones</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Admin Panel</div>
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 4 }}>
              <button onClick={() => toggleSection(section.title)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px 20px' : '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: section.color, flexShrink: 0 }} />
                {!collapsed && (
                  <>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap' }}>{section.title}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', transition: 'transform .2s', transform: openSections[section.title] ? 'rotate(0)' : 'rotate(-90deg)' }}>▼</span>
                  </>
                )}
              </button>

              {openSections[section.title] && !collapsed && section.items.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 28px', background: isActive ? 'rgba(200,151,58,.15)' : 'transparent', borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent', cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#c8973a' : 'rgba(255,255,255,.8)', lineHeight: 1.3 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {collapsed && openSections[section.title] && section.items.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={item.name}>
                    <div style={{ padding: '6px 0', textAlign: 'center', fontSize: 16, background: isActive ? 'rgba(200,151,58,.15)' : 'transparent', borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent' }}>
                      {item.icon}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 10, color: 'rgba(255,255,255,.2)' }}>
            Game of Bones Admin<br />gameofbones@gmail.com
          </div>
        )}
      </aside>

      {/* Applies the margin-shift class to <body> so main content reflows correctly
          without needing any changes to layout.tsx */}
      <ApplyBodyShiftClass />
    </>
  );
}

// Adds/keeps a class on <body> so the global style above can push content over.
// This runs client-side only, is idempotent, and requires zero other file changes.
function ApplyBodyShiftClass() {
  useEffect(() => {
    document.body.classList.add('gob-admin-content-shift');
  }, []);
  return null;
}
