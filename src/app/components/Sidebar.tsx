'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Boxes, ClipboardList, FileText, HeartHandshake, LayoutDashboard,
  Megaphone, PackageCheck, Settings2, ShoppingCart, Truck, Users, WalletCards,
} from 'lucide-react';

const SECTIONS = [
  { title: 'START HERE', color: '#c8973a', items: [
    { name: 'Today', href: '/dashboard', icon: LayoutDashboard, desc: "Today's work, exceptions and sales" },
    { name: 'Insights', href: '/analytics', icon: BarChart3, desc: 'Demand, retention and performance signals' },
  ]},
  { title: 'WORKSPACE', color: '#f59e0b', items: [
    { name: 'Orders', href: '/orders', icon: ShoppingCart, desc: 'One queue for customer and order work' },
    { name: 'Fulfilment', href: '/delhivery', icon: Truck, desc: 'Dispatch, shipping and delivery operations' },
    { name: 'Products', href: '/products', icon: PackageCheck, desc: 'Catalog, stock and product performance' },
    { name: 'Customers', href: '/customers', icon: Users, desc: 'Profiles, loyalty and retention' },
  ]},
  { title: 'GROWTH', color: '#f97316', items: [
    { name: 'Marketing', href: '/campaigns-hub', icon: Megaphone, desc: 'Campaigns, offers and acquisition' },
    { name: 'Content', href: '/site-content', icon: FileText, desc: 'Storefront, blogs and social proof' },
  ]},
  { title: 'FINANCE', color: '#84cc16', items: [
    { name: 'Finance', href: '/finance', icon: WalletCards, desc: 'Revenue, margin, payments and invoices' },
  ]},
  { title: 'MORE TOOLS', color: '#78716c', collapsedByDefault: true, items: [
    { name: 'Manual Order', href: '/manual-order', icon: ClipboardList, desc: 'Phone, walk-in and offline orders' },
    { name: 'COD & Exceptions', href: '/cod-tracker', icon: ClipboardList, desc: 'COD, cancellations and duplicates' },
    { name: 'Returns & RTO', href: '/returns', icon: Truck, desc: 'Returns, refunds and RTO recovery' },
    { name: 'Inventory & Production', href: '/inventory', icon: Boxes, desc: 'Stock, batches and production work' },
    { name: 'Loyalty & Recovery', href: '/gamification', icon: HeartHandshake, desc: 'Rewards, birthdays, carts and referrals' },
    { name: 'Campaign tools', href: '/campaigns', icon: Megaphone, desc: 'Coupons, captures, influencers and promotions' },
    { name: 'Detailed reports', href: '/cohort-analysis', icon: BarChart3, desc: 'Cohorts, city and hour analysis' },
    { name: 'Admin & exports', href: '/tasks', icon: Settings2, desc: 'Tasks, team, audit trail and exports' },
  ]},
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 60;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.title, !s.collapsedByDefault]))
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
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 28px', background: isActive ? 'rgba(200,151,58,.15)' : 'transparent', borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent', cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span style={{ display: 'flex', flexShrink: 0, width: 20, justifyContent: 'center', color: isActive ? '#e8c76d' : 'rgba(255,255,255,.58)' }}>
                        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                      </span>
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
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={item.name}>
                    <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', color: isActive ? '#e8c76d' : 'rgba(255,255,255,.62)', background: isActive ? 'rgba(200,151,58,.15)' : 'transparent', borderLeft: isActive ? '3px solid #c8973a' : '3px solid transparent' }}>
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
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
