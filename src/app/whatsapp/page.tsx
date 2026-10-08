'use client';

import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '@/app/lib/authedFetch';

type KindStats = { sent: number; delivered: number; read: number; failed: number; skipped: number };
type Overview = {
  env: { token: boolean; phoneNumberId: boolean; businessAccountId: boolean; appSecret: boolean; verifyToken: boolean };
  settings: {
    enabled: boolean; cart_reminders: boolean; order_updates: boolean;
    reminder1_delay_minutes: number; reminder2_delay_hours: number;
    enabled_at: string | null; last_run_at: string | null; last_run_result: unknown; last_webhook_at: string | null;
  };
  phone: { display_phone_number?: string; verified_name?: string; quality_rating?: string; messaging_limit_tier?: string; name_status?: string; code_verification_status?: string } | null;
  phoneError: string | null;
  templates: { name: string; category: string; purpose: string; body: string; button: string | null; status: string; rejected_reason: string | null }[];
  templatesError: string | null;
  webhookUrl: string;
  stats: {
    days: number; byKind: Record<string, KindStats>; estimatedCost: number; recoveredOrders: number; recoveredRevenue: number;
    optouts: number; cartsOptedIn: number; cartsWithPhone: number; ordersOptedIn: number; ordersTotal: number;
  };
  recent: { id: string; created_at: string; kind: string; template: string | null; status: string; status_at: string | null; phone_last4: string | null; order_ref: string | null; error: string | null }[];
  inbound: { id: string; created_at: string; handled: boolean; msg_type: string; name: string; phone: string; body: string; can_reply: boolean }[];
};

const C = { ink: '#102c22', gold: '#9a6514', line: '#e7dcc4', soft: '#fbf7ee', muted: '#7a6a55', green: '#1f7a4d', red: '#b23a2e', amber: '#b7791f' };
const KIND_LABEL: Record<string, string> = {
  cart_reminder_1: 'Cart reminder #1', cart_reminder_2: 'Cart reminder #2', order_confirmed: 'Order confirmed',
  order_shipped: 'Order shipped', order_delivered: 'Order delivered', reply: 'Your reply', test: 'Test message',
};
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function Section({ eyebrow, title, children, right }: { eyebrow: string; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.gold }}>{eyebrow}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>{title}</div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a7350' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, marginTop: 4, fontFamily: 'Georgia, serif' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Pill({ ok, children, tone }: { ok?: boolean; children: React.ReactNode; tone?: 'amber' | 'red' | 'green' | 'grey' }) {
  const t = tone || (ok ? 'green' : 'red');
  const colors = { green: ['#e3f3ea', C.green], red: ['#fbe7e4', C.red], amber: ['#fdf1dc', C.amber], grey: ['#eee', '#555'] }[t];
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: colors[0], color: colors[1], fontSize: 12, fontWeight: 700 }}>{children}</span>;
}
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 48, height: 26, borderRadius: 999, border: 0, cursor: disabled ? 'not-allowed' : 'pointer', background: on ? C.green : '#c9c2b3', position: 'relative', opacity: disabled ? .5 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}
const btn = (primary = false): React.CSSProperties => ({ padding: '9px 14px', borderRadius: 9, border: `1px solid ${primary ? C.ink : '#d9ccae'}`, background: primary ? C.ink : '#fff', color: primary ? '#fff' : C.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' });
const statusTone = (s: string): 'green' | 'amber' | 'red' | 'grey' => s === 'APPROVED' || s === 'read' || s === 'delivered' ? 'green' : s === 'PENDING' || s === 'sent' || s === 'IN_APPEAL' ? 'amber' : s === 'REJECTED' || s === 'failed' || s === 'PAUSED' || s === 'DISABLED' ? 'red' : 'grey';

export default function WhatsappPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testTemplate, setTestTemplate] = useState('hello_world');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [delays, setDelays] = useState({ r1: 60, r2: 24 });

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/admin/whatsapp?days=${days}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load WhatsApp data');
      setData(json); setError('');
      setDelays({ r1: json.settings.reminder1_delay_minutes, r2: json.settings.reminder2_delay_hours });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load WhatsApp data'); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, payload: Record<string, unknown> = {}, label = action) {
    setBusy(label); setNotice(''); setError('');
    try {
      const res = await authedFetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      return json;
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); return null; }
    finally { setBusy(''); }
  }

  if (!data) return <div style={{ padding: 24 }}>{error ? <span style={{ color: C.red }}>{error}</span> : 'Loading WhatsApp…'}</div>;

  const { env, settings, stats } = data;
  const envReady = env.token && env.phoneNumberId && env.businessAccountId;
  const approved = data.templates.filter(t => t.status === 'APPROVED').length;
  const cartTemplatesOk = data.templates.filter(t => t.name.startsWith('gob_cart')).every(t => t.status === 'APPROVED');
  const k = (name: string) => stats.byKind[name] || { sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0 };
  const cart1 = k('cart_reminder_1'), cart2 = k('cart_reminder_2');
  const cartSent = cart1.sent + cart2.sent;
  const orderSent = k('order_confirmed').sent + k('order_shipped').sent + k('order_delivered').sent;
  const totalFailed = Object.values(stats.byKind).reduce((s, x) => s + x.failed, 0);
  const unread = data.inbound.filter(m => !m.handled).length;
  const runResult = settings.last_run_result as { status?: string; carts?: Record<string, number> | string; orders?: Record<string, number> | string } | null;

  const steps: { done: boolean; title: string; detail: React.ReactNode }[] = [
    { done: envReady, title: 'Connect your WhatsApp Business number to Meta', detail: <>
      In <a href="https://business.facebook.com" target="_blank" rel="noreferrer">Meta Business Suite</a> → Settings → Accounts → WhatsApp accounts, add a WhatsApp Business Account and a phone number (a new number, or your existing one if Meta offers to keep the WhatsApp Business app on it). Complete <b>Business verification</b> (Security Centre) so you can message more than 250 customers a day.
    </> },
    { done: envReady, title: 'Create a permanent access token and add it to Vercel', detail: <>
      In <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta for Developers</a>, create a Business app with the WhatsApp product. In Business Settings → System users, create an admin system user, assign the app and the WhatsApp account, and generate a token with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>. Then in Vercel → gameofbones-admin → Settings → Environment Variables add:
      <ul style={{ margin: '6px 0 0 18px' }}>
        <li><code>WHATSAPP_ACCESS_TOKEN</code> — the system-user token {env.token ? <Pill ok>set</Pill> : <Pill>missing</Pill>}</li>
        <li><code>WHATSAPP_PHONE_NUMBER_ID</code> — WhatsApp Manager → API setup {env.phoneNumberId ? <Pill ok>set</Pill> : <Pill>missing</Pill>}</li>
        <li><code>WHATSAPP_BUSINESS_ACCOUNT_ID</code> — the WhatsApp Business Account ID {env.businessAccountId ? <Pill ok>set</Pill> : <Pill>missing</Pill>}</li>
        <li><code>WHATSAPP_APP_SECRET</code> — App settings → Basic → App secret {env.appSecret ? <Pill ok>set</Pill> : <Pill>missing</Pill>}</li>
        <li><code>WHATSAPP_VERIFY_TOKEN</code> — any random word you choose {env.verifyToken ? <Pill ok>set</Pill> : <Pill>missing</Pill>}</li>
      </ul>
      After adding them, redeploy the admin project once so they take effect.
    </> },
    { done: Boolean(settings.last_webhook_at), title: 'Connect the webhook (delivery ticks, replies and STOP requests)', detail: <>
      In the Meta app → WhatsApp → Configuration → Webhook: Callback URL <code>{data.webhookUrl}</code>, Verify token = your <code>WHATSAPP_VERIFY_TOKEN</code>. Then subscribe to the <b>messages</b> field. {settings.last_webhook_at ? <>Last event received {fmt(settings.last_webhook_at)}.</> : 'No events received yet.'}
    </> },
    { done: approved === data.templates.length, title: 'Get the message templates approved', detail: <>Use “Submit templates to Meta” below. Approval usually takes from a few minutes to 24 hours. {approved}/{data.templates.length} approved.</> },
    { done: settings.enabled, title: 'Send yourself a test, then switch WhatsApp on', detail: <>Use “Send a test” with your own number. When it arrives, turn on the main switch. Only carts and orders created <b>after</b> you switch on are messaged.</> },
  ];

  return (
    <div style={{ padding: '22px 24px', maxWidth: 1200, margin: '0 auto', color: C.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontFamily: 'Georgia, serif' }}>💬 WhatsApp</h1>
          <div style={{ color: C.muted, fontSize: 14 }}>Automatic cart reminders, order updates and customer replies through the official WhatsApp Business Platform.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px' }}>
          <div>
            <div style={{ fontWeight: 800 }}>{settings.enabled ? 'WhatsApp is ON' : 'WhatsApp is OFF'}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{settings.enabled ? `Since ${fmt(settings.enabled_at)}` : envReady ? 'Ready to switch on once templates are approved' : 'Finish setup first'}</div>
          </div>
          <Toggle on={settings.enabled} disabled={!envReady || busy === 'toggle'} onChange={async v => {
            if (v && !cartTemplatesOk && !confirm('Some templates are not approved yet. Messages using them will fail until Meta approves them. Switch on anyway?')) return;
            if (await act('save_settings', { enabled: v }, 'toggle')) { setNotice(v ? 'WhatsApp switched on.' : 'WhatsApp switched off. No more automatic messages will be sent.'); load(); }
          }} />
        </div>
      </div>

      {error && <div style={{ background: '#fbe7e4', color: C.red, padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 14 }}>{error}</div>}
      {notice && <div style={{ background: '#e3f3ea', color: C.green, padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 14 }}>{notice}</div>}

      <Section eyebrow="Results" title="How WhatsApp is performing" right={
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d9ccae' }}>
          <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <Card label="Cart reminders sent" value={cartSent} sub={`${cart1.sent} first · ${cart2.sent} second · ${pct(cart1.read + cart2.read, cartSent)} read`} />
          <Card label="Orders after a reminder" value={stats.recoveredOrders} sub={`₹${Math.round(stats.recoveredRevenue).toLocaleString('en-IN')} placed within 7 days of a reminder`} />
          <Card label="Order updates sent" value={orderSent} sub={`${k('order_confirmed').sent} confirmed · ${k('order_shipped').sent} shipped · ${k('order_delivered').sent} delivered`} />
          <Card label="Customer replies" value={data.inbound.length} sub={`${unread} waiting for you`} />
          <Card label="Estimated cost" value={`₹${stats.estimatedCost.toLocaleString('en-IN')}`} sub="≈ ₹0.86 per reminder, ₹0.15 per order update" />
          <Card label="Failed / opted out" value={`${totalFailed} / ${stats.optouts}`} sub="Failed sends · customers who replied STOP" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 12 }}>
          <Card label="Carts that allowed WhatsApp" value={`${stats.cartsOptedIn} / ${stats.cartsWithPhone}`} sub={`${pct(stats.cartsOptedIn, stats.cartsWithPhone)} of carts with a phone number ticked WhatsApp`} />
          <Card label="Orders that allowed WhatsApp" value={`${stats.ordersOptedIn} / ${stats.ordersTotal}`} sub={`${pct(stats.ordersOptedIn, stats.ordersTotal)} of orders will get WhatsApp updates`} />
        </div>
      </Section>

      <Section eyebrow="Setup" title={`Setup checklist (${steps.filter(s => s.done).length}/${steps.length} done)`}>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {steps.map((s, i) => (
            <li key={s.title} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12 }}>
              <div style={{ width: 26, height: 26, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: s.done ? C.green : '#efe6d2', color: s.done ? '#fff' : C.ink }}>{s.done ? '✓' : i + 1}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}><div style={{ fontWeight: 800, marginBottom: 2 }}>{s.title}</div><div style={{ color: '#4f4436' }}>{s.detail}</div></div>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Connected number</div>
            {data.phone ? <>
              <div>{data.phone.verified_name} · {data.phone.display_phone_number}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pill tone={data.phone.quality_rating === 'GREEN' ? 'green' : data.phone.quality_rating === 'YELLOW' ? 'amber' : data.phone.quality_rating === 'RED' ? 'red' : 'grey'}>Quality: {data.phone.quality_rating || 'n/a'}</Pill>
                <Pill tone="grey">Limit: {String(data.phone.messaging_limit_tier || 'n/a').replace('TIER_', '')} customers/day</Pill>
                <Pill tone={data.phone.name_status === 'APPROVED' ? 'green' : 'amber'}>Display name: {data.phone.name_status || 'n/a'}</Pill>
              </div>
            </> : <div style={{ color: C.muted }}>{data.phoneError || 'Not connected yet.'}</div>}
          </div>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Scheduler</div>
            <div>Runs automatically every 15 minutes.</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Last run: {fmt(settings.last_run_at)} {runResult?.status ? `· ${runResult.status === 'ok' ? 'OK' : runResult.status === 'off' ? 'switched off' : runResult.status === 'not_configured' ? 'not configured' : runResult.status}` : ''}</div>
            {runResult?.status === 'ok' && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{JSON.stringify({ carts: runResult.carts, orders: runResult.orders })}</div>}
            <button style={{ ...btn(), marginTop: 8 }} disabled={busy === 'run'} onClick={async () => { const r = await act('run_now', {}, 'run'); if (r) { setNotice(`Run finished: ${JSON.stringify(r.result)}`); load(); } }}>{busy === 'run' ? 'Running…' : 'Run now'}</button>
          </div>
        </div>
      </Section>

      <Section eyebrow="Automations" title="What gets sent, and when">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div><div style={{ fontWeight: 800 }}>🛒 Cart reminders</div><div style={{ fontSize: 13, color: C.muted }}>For shoppers who left treats in their bag and allowed WhatsApp. Stops automatically if they order.</div></div>
              <Toggle on={settings.cart_reminders} disabled={busy === 'cart'} onChange={async v => { if (await act('save_settings', { cart_reminders: v }, 'cart')) load(); }} />
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 14, alignItems: 'center' }}>
              <label>Reminder 1 after <input type="number" min={15} max={1440} value={delays.r1} onChange={e => setDelays(d => ({ ...d, r1: Number(e.target.value) }))} style={{ width: 70, padding: 6, borderRadius: 6, border: '1px solid #d9ccae' }} /> minutes</label>
              <label>Reminder 2 (with their coupon) after <input type="number" min={2} max={72} value={delays.r2} onChange={e => setDelays(d => ({ ...d, r2: Number(e.target.value) }))} style={{ width: 60, padding: 6, borderRadius: 6, border: '1px solid #d9ccae' }} /> hours</label>
              <button style={btn()} disabled={busy === 'delays'} onClick={async () => { if (await act('save_settings', { reminder1_delay_minutes: delays.r1, reminder2_delay_hours: delays.r2 }, 'delays')) { setNotice('Timings saved.'); load(); } }}>Save timings</button>
            </div>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div><div style={{ fontWeight: 800 }}>📦 Order updates</div><div style={{ fontSize: 13, color: C.muted }}>Order confirmed → shipped (with Delhivery AWB) → delivered, for customers who allowed WhatsApp at checkout.</div></div>
            <Toggle on={settings.order_updates} disabled={busy === 'orders'} onChange={async v => { if (await act('save_settings', { order_updates: v }, 'orders')) load(); }} />
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            Rules built in: only customers who ticked the WhatsApp box are messaged · anyone who replies <b>STOP</b> is never messaged again (START re-subscribes) · at most 2 cart reminders per cart · no reminders if an order was placed · nothing is sent for carts or orders from before WhatsApp was switched on.
          </div>
        </div>
      </Section>

      <Section eyebrow="Templates" title={`Message templates (${approved}/${data.templates.length} approved by Meta)`} right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn()} onClick={load}>Refresh status</button>
          <button style={btn(true)} disabled={!envReady || busy === 'templates'} onClick={async () => {
            const r = await act('submit_templates', {}, 'templates');
            if (r) { setNotice(r.results.map((x: { name: string; result: string }) => `${x.name}: ${x.result}`).join(' · ')); load(); }
          }}>{busy === 'templates' ? 'Submitting…' : 'Submit templates to Meta'}</button>
        </div>}>
        {data.templatesError && <div style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{data.templatesError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
          {data.templates.map(t => (
            <div key={t.name} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{t.purpose}</div>
                <Pill tone={statusTone(t.status)}>{t.status.replace('_', ' ').toLowerCase()}</Pill>
              </div>
              <div style={{ fontSize: 12, color: C.muted, margin: '2px 0 8px' }}><code>{t.name}</code> · {t.category === 'MARKETING' ? 'Marketing (≈ ₹0.86)' : 'Utility (≈ ₹0.15)'}</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#e7f6df', borderRadius: 10, padding: '10px 12px', lineHeight: 1.45 }}>{t.body}{t.button ? `\n\n🔗 ${t.button}` : ''}</div>
              {t.rejected_reason && t.rejected_reason !== 'NONE' && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>Rejected: {t.rejected_reason}</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{'{{1}}'}, {'{{2}}'}… are filled automatically with the customer’s first name, items, total, order number, coupon or AWB.</div>
      </Section>

      <Section eyebrow="Test" title="Send a test message">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Your 10-digit WhatsApp number" value={testPhone} onChange={e => setTestPhone(e.target.value)} style={{ padding: 9, borderRadius: 8, border: '1px solid #d9ccae', minWidth: 230 }} />
          <select value={testTemplate} onChange={e => setTestTemplate(e.target.value)} style={{ padding: 9, borderRadius: 8, border: '1px solid #d9ccae' }}>
            <option value="hello_world">hello_world (Meta’s default, works immediately)</option>
            {data.templates.map(t => <option key={t.name} value={t.name}>{t.purpose}</option>)}
          </select>
          <button style={btn(true)} disabled={!envReady || busy === 'test'} onClick={async () => { if (await act('test_send', { phone: testPhone, template: testTemplate }, 'test')) { setNotice('Test sent. Check your WhatsApp.'); load(); } }}>{busy === 'test' ? 'Sending…' : 'Send test'}</button>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Tests use sample details (name “Anjan”, order GOB-TEST). Each test costs the same as a real message.</div>
      </Section>

      <Section eyebrow="Inbox" title={`Customer replies${unread ? ` (${unread} new)` : ''}`}>
        {!data.inbound.length && <div style={{ color: C.muted, fontSize: 14 }}>No replies yet. Messages customers send to your WhatsApp number appear here once the webhook is connected.</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {data.inbound.map(m => (
            <div key={m.id} style={{ background: '#fff', border: `1px solid ${m.handled ? C.line : '#e2b867'}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <div><b>{m.name || 'Customer'}</b> · {m.phone} · <span style={{ color: C.muted }}>{fmt(m.created_at)}</span></div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {m.handled ? <Pill ok>handled</Pill> : <Pill tone="amber">needs reply</Pill>}
                  <button style={{ ...btn(), padding: '4px 10px', fontSize: 12 }} onClick={async () => { if (await act('mark_handled', { id: m.id, handled: !m.handled }, `h-${m.id}`)) load(); }}>{m.handled ? 'Mark unread' : 'Mark handled'}</button>
                </div>
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 14 }}>{m.body}</div>
              {m.can_reply ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input placeholder="Type a reply…" value={replies[m.id] || ''} onChange={e => setReplies(r => ({ ...r, [m.id]: e.target.value }))} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #d9ccae' }} />
                  <button style={btn(true)} disabled={busy === `r-${m.id}`} onClick={async () => { if (await act('reply', { id: m.id, text: replies[m.id] }, `r-${m.id}`)) { setReplies(r => ({ ...r, [m.id]: '' })); setNotice('Reply sent.'); load(); } }}>Send</button>
                </div>
              ) : <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>More than 24 hours old: reply from the WhatsApp app, or wait for the customer to message again.</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Log" title="Recent messages">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 12 }}>
            <thead><tr style={{ textAlign: 'left', background: '#f3ead6' }}>{['When', 'Message', 'To', 'Order', 'Status', 'Note'].map(h => <th key={h} style={{ padding: '8px 10px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {!data.recent.length && <tr><td colSpan={6} style={{ padding: 12, color: C.muted }}>Nothing sent yet.</td></tr>}
              {data.recent.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                  <td style={{ padding: '7px 10px' }}>{KIND_LABEL[r.kind] || r.kind}</td>
                  <td style={{ padding: '7px 10px' }}>{r.phone_last4 ? `•••• ${r.phone_last4}` : '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{r.order_ref || '—'}</td>
                  <td style={{ padding: '7px 10px' }}><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
                  <td style={{ padding: '7px 10px', color: C.red, maxWidth: 360 }}>{r.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Good to know" title="Rules and costs">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.65, color: '#4f4436' }}>
          <li>Meta charges per delivered template message. In India, marketing messages (cart reminders) are about ₹0.86 and utility messages (order updates) about ₹0.15, plus GST. Replies you type within 24 hours of a customer’s message are free. Check the exact rates in WhatsApp Manager → Insights.</li>
          <li>Customers are only messaged if they ticked “Send me order updates and a cart reminder on WhatsApp” at checkout, or added their WhatsApp number in the cart’s save-your-bag box.</li>
          <li>Keep the quality rating Green. Too many blocks or reports lower your limits, so we send at most 2 cart reminders and stop as soon as someone orders or replies STOP.</li>
          <li>New business numbers can message up to 250 customers a day until Meta verifies the business; after verification the limit rises automatically as quality stays high.</li>
          <li>The cart reminder button opens <code>gameofbones.in/cart?restore=…</code>, which rebuilds the customer’s exact bag. Prices are re-checked at checkout.</li>
        </ul>
      </Section>
    </div>
  );
}
