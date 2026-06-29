'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

function RevenueChart({ data, days }: { data: { date: string; revenue: number; orders: number }[]; days: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padL = 60, padR = 20, padT = 20, padB = 40;
    const cw = w - padL - padR, ch = h - padT - padB;

    const maxRev = Math.max(...data.map(d => d.revenue), 100);
    const yScale = ch / maxRev;
    const xStep = cw / Math.max(data.length - 1, 1);

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + ch - (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('₹' + Math.round(maxRev / 4 * i).toLocaleString('en-IN'), padL - 8, y + 4);
    }

    // Area fill
    ctx.beginPath();
    ctx.moveTo(padL, padT + ch);
    data.forEach((d, i) => {
      const x = padL + i * xStep;
      const y = padT + ch - d.revenue * yScale;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padL + (data.length - 1) * xStep, padT + ch);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
    grad.addColorStop(0, 'rgba(200, 151, 58, 0.25)');
    grad.addColorStop(1, 'rgba(200, 151, 58, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#c8973a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    data.forEach((d, i) => {
      const x = padL + i * xStep;
      const y = padT + ch - d.revenue * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
      const x = padL + i * xStep;
      const y = padT + ch - d.revenue * yScale;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#c8973a';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelStep = data.length > 14 ? 3 : data.length > 7 ? 2 : 1;
    data.forEach((d, i) => {
      if (i % labelStep !== 0 && i !== data.length - 1) return;
      const x = padL + i * xStep;
      const parts = d.date.split('-');
      ctx.fillText(`${parseInt(parts[2])}/${parseInt(parts[1])}`, x, padT + ch + 20);
    });
  }, [data]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: 280, display: 'block' }} />;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(7);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
    setOrders(data || []);
    setLoading(false);
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at?.startsWith(today));
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const weekOrders = orders.filter(o => o.created_at >= weekAgo && o.status !== 'cancelled');
  const monthOrders = orders.filter(o => o.created_at >= monthAgo && o.status !== 'cancelled');

  const todayRevenue = todayOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0);
  const weekRevenue = weekOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0);
  const monthRevenue = monthOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0);
  const pendingDispatch = orders.filter(o => ['placed', 'confirmed'].includes(o.status)).length;
  const uniqueCustomers = new Set(orders.map(o => (o.customer_phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean)).size;
  const avgOrderValue = monthOrders.length > 0 ? Math.round(monthRevenue / monthOrders.length) : 0;
  const codCount = monthOrders.filter(o => o.payment_method === 'cod').length;
  const codRate = monthOrders.length > 0 ? Math.round(codCount / monthOrders.length * 100) : 0;

  // Chart data
  const chartData = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr) && o.status !== 'cancelled');
    chartData.push({
      date: dateStr,
      revenue: dayOrders.reduce((s, o) => s + (o.grand_total || o.total_amount || 0), 0),
      orders: dayOrders.length
    });
  }

  // Status breakdown
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString('en-IN')}`, sub: `${todayOrders.length} orders`, color: '#16a34a' },
          { label: '7-Day Revenue', value: `₹${weekRevenue.toLocaleString('en-IN')}`, sub: `${weekOrders.length} orders`, color: '#c8973a' },
          { label: '30-Day Revenue', value: `₹${monthRevenue.toLocaleString('en-IN')}`, sub: `${monthOrders.length} orders`, color: '#1a1008' },
          { label: 'Pending Dispatch', value: String(pendingDispatch), sub: 'Need action', color: pendingDispatch > 0 ? '#ef4444' : '#16a34a' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9ca3af', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color, fontFamily: 'Georgia, serif' }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Second row KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Customers', value: String(uniqueCustomers) },
          { label: 'Avg Order Value', value: `₹${avgOrderValue.toLocaleString('en-IN')}` },
          { label: 'COD Rate', value: `${codRate}%` },
          { label: 'Total Orders', value: String(orders.length) },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9ca3af', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Revenue Trend</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setChartDays(d)}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  background: chartDays === d ? '#1a1008' : '#f3f4f6',
                  color: chartDays === d ? '#fff' : '#6b7280',
                  border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                {d}D
              </button>
            ))}
          </div>
        </div>
        {!loading && <RevenueChart data={chartData} days={chartDays} />}
      </div>

      {/* Status breakdown + Recent orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Order Status</h3>
          {Object.entries(statusCounts).sort(([, a], [, b]) => (b as number) - (a as number)).map(([status, count]) => {
            const colors: Record<string, string> = { placed: '#f59e0b', confirmed: '#3b82f6', dispatched: '#8b5cf6', shipped: '#8b5cf6', delivered: '#16a34a', cancelled: '#ef4444' };
            const pct = orders.length > 0 ? Math.round((count as number) / orders.length * 100) : 0;
            return (
              <div key={status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                  <span style={{ color: '#6b7280' }}>{count as number} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: colors[status] || '#9ca3af', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Recent Orders</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ref</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{o.ref}</td>
                  <td style={{ padding: '8px', color: '#6b7280' }}>{o.customer_name || o.customer_phone}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>₹{(o.grand_total || o.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 10,
                      background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                      color: o.status === 'delivered' ? '#16a34a' : o.status === 'cancelled' ? '#ef4444' : '#92400e' }}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
