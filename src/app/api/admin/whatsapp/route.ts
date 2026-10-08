import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { decryptPii } from '@/app/lib/pii-crypto'
import {
  ADMIN_BASE, ESTIMATED_COST_INR, TEMPLATES, db, getSettings, listMetaTemplates, phoneNumberInfo,
  sendTemplate, sendText, submitTemplate, whatsappEnv,
} from '@/app/lib/whatsapp'
import { runAll } from '@/app/lib/whatsapp-runner'

export const maxDuration = 60
const safe = (v: string | null | undefined) => { try { return decryptPii(v) } catch { return '' } }
const DAY = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError
  const days = Math.min(365, Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get('days') || 30))))
  const since = new Date(Date.now() - days * DAY).toISOString()

  const settings = await getSettings()
  const { cron_key: _hidden, ...publicSettings } = settings
  void _hidden
  const env = whatsappEnv()

  let phone: unknown = null, phoneError: string | null = null
  let metaTemplates: Awaited<ReturnType<typeof listMetaTemplates>> = null, templatesError: string | null = null
  try { phone = await phoneNumberInfo() } catch (e) { phoneError = e instanceof Error ? e.message : 'Unable to reach Meta' }
  try { metaTemplates = await listMetaTemplates() } catch (e) { templatesError = e instanceof Error ? e.message : 'Unable to reach Meta' }

  const templates = TEMPLATES.map(t => {
    const live = metaTemplates?.find(m => m.name === t.name)
    return { name: t.name, category: t.category, purpose: t.purpose, body: t.body, button: t.button ? `${t.button.text} → ${t.button.urlBase}…` : null, status: live?.status || (metaTemplates ? 'NOT_SUBMITTED' : 'UNKNOWN'), rejected_reason: live?.rejected_reason || null }
  })

  const [messagesRes, recentRes, inboundRes, optoutsRes, cartOptRes, cartAllRes, orderOptRes, orderAllRes] = await Promise.all([
    db.from('whatsapp_messages').select('kind,category,status,phone_hash,created_at,cart_id').gte('created_at', since).limit(5000),
    db.from('whatsapp_messages').select('id,created_at,kind,template,status,status_at,phone_last4,order_ref,error').order('created_at', { ascending: false }).limit(100),
    db.from('whatsapp_inbound').select('id,created_at,phone_hash,phone_ciphertext,name_ciphertext,body_ciphertext,msg_type,handled').order('created_at', { ascending: false }).limit(50),
    db.from('whatsapp_optouts').select('phone_hash', { count: 'exact', head: true }),
    db.from('abandoned_carts').select('id', { count: 'exact', head: true }).gte('abandoned_at', since).eq('whatsapp_opt_in', true),
    db.from('abandoned_carts').select('id', { count: 'exact', head: true }).gte('abandoned_at', since).or('customer_phone.not.is.null,pii_phone_hash.not.is.null'),
    db.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('whatsapp_opt_in', true).neq('status', 'pending_payment'),
    db.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since).neq('status', 'pending_payment'),
  ])

  const messages = messagesRes.data || []
  const byKind: Record<string, { sent: number; delivered: number; read: number; failed: number; skipped: number }> = {}
  let cost = 0
  for (const m of messages) {
    const k = (byKind[m.kind] ||= { sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0 })
    if (m.status === 'failed') k.failed++
    else if (m.status === 'skipped') k.skipped++
    else {
      k.sent++
      if (m.status === 'delivered' || m.status === 'read') k.delivered++
      if (m.status === 'read') k.read++
      cost += ESTIMATED_COST_INR[m.category || ''] ?? 0
    }
  }

  // Orders placed within 7 days after a WhatsApp cart reminder, matched by phone.
  const reminders = messages.filter(m => m.kind.startsWith('cart_reminder') && !['failed', 'skipped'].includes(m.status) && m.phone_hash)
  const firstReminder = new Map<string, number>()
  for (const r of reminders) {
    const t = new Date(r.created_at).getTime()
    if (!firstReminder.has(r.phone_hash!) || t < firstReminder.get(r.phone_hash!)!) firstReminder.set(r.phone_hash!, t)
  }
  let recoveredOrders = 0, recoveredRevenue = 0
  if (firstReminder.size) {
    const { data: orders } = await db.from('orders').select('pii_phone_hash,grand_total,created_at,status').in('pii_phone_hash', [...firstReminder.keys()]).gte('created_at', since)
    for (const o of orders || []) {
      if (o.status === 'pending_payment' || /^cancel/i.test(String(o.status || ''))) continue
      const start = firstReminder.get(o.pii_phone_hash)
      const t = new Date(o.created_at).getTime()
      if (start && t >= start && t - start <= 7 * DAY) { recoveredOrders++; recoveredRevenue += Number(o.grand_total) || 0 }
    }
  }

  const inbound = (inboundRes.data || []).map(m => {
    const phoneDigits = safe(m.phone_ciphertext)
    return {
      id: m.id, created_at: m.created_at, handled: m.handled, msg_type: m.msg_type,
      name: safe(m.name_ciphertext), phone: phoneDigits ? `+91 ${phoneDigits.slice(0, 5)} ${phoneDigits.slice(5)}` : '',
      body: safe(m.body_ciphertext),
      can_reply: Date.now() - new Date(m.created_at).getTime() < 23.5 * 60 * 60 * 1000,
    }
  })

  return NextResponse.json({
    env, settings: publicSettings, phone, phoneError, templates, templatesError,
    webhookUrl: `${ADMIN_BASE}/api/whatsapp/webhook`,
    stats: {
      days, byKind, estimatedCost: Math.round(cost * 100) / 100,
      recoveredOrders, recoveredRevenue,
      optouts: optoutsRes.count || 0,
      cartsOptedIn: cartOptRes.count || 0, cartsWithPhone: cartAllRes.count || 0,
      ordersOptedIn: orderOptRes.count || 0, ordersTotal: orderAllRes.count || 0,
    },
    recent: recentRes.data || [],
    inbound,
  })
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  try {
    if (action === 'save_settings') {
      const current = await getSettings()
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof body.enabled === 'boolean') {
        patch.enabled = body.enabled
        // Messages only go to carts/orders created after WhatsApp was switched on.
        if (body.enabled && !current.enabled) patch.enabled_at = new Date().toISOString()
      }
      if (typeof body.cart_reminders === 'boolean') patch.cart_reminders = body.cart_reminders
      if (typeof body.order_updates === 'boolean') patch.order_updates = body.order_updates
      if (Number.isFinite(Number(body.reminder1_delay_minutes))) patch.reminder1_delay_minutes = Math.min(1440, Math.max(15, Math.round(Number(body.reminder1_delay_minutes))))
      if (Number.isFinite(Number(body.reminder2_delay_hours))) patch.reminder2_delay_hours = Math.min(72, Math.max(2, Math.round(Number(body.reminder2_delay_hours))))
      const { error } = await db.from('whatsapp_settings').update(patch).eq('id', 1)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'submit_templates') {
      const existing = (await listMetaTemplates()) || []
      const results: { name: string; result: string }[] = []
      for (const t of TEMPLATES) {
        if (existing.some(m => m.name === t.name)) { results.push({ name: t.name, result: 'already submitted' }); continue }
        try { await submitTemplate(t); results.push({ name: t.name, result: 'submitted' }) }
        catch (e) { results.push({ name: t.name, result: e instanceof Error ? e.message : 'failed' }) }
      }
      return NextResponse.json({ ok: true, results })
    }

    if (action === 'run_now') {
      return NextResponse.json({ ok: true, result: await runAll(await getSettings()) })
    }

    if (action === 'test_send') {
      const phone = String(body.phone || '')
      const template = String(body.template || 'hello_world')
      const sample: Record<string, { params: string[]; button?: string }> = {
        hello_world: { params: [] },
        gob_cart_reminder_1: { params: ['Anjan', 'Chicken Jerky × 1, Goat Trotter × 2', '779'], button: 'test' },
        gob_cart_reminder_2: { params: ['Anjan', 'SAVE10-TEST1', '10%'], button: 'test' },
        gob_order_confirmed: { params: ['Anjan', 'GOB-TEST', '1,199', 'Paid online'], button: 'GOB-TEST' },
        gob_order_shipped: { params: ['Anjan', 'GOB-TEST', '1234567890123'], button: 'GOB-TEST' },
        gob_order_delivered: { params: ['Anjan', 'GOB-TEST'] },
      }
      const s = sample[template]
      if (!s) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      const r = await sendTemplate({ kind: 'test', phone }, template, s.params, s.button, { ignoreOptOut: true })
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 })
    }

    if (action === 'reply') {
      const { data: msg } = await db.from('whatsapp_inbound').select('id,created_at,phone_ciphertext').eq('id', String(body.id || '')).maybeSingle()
      if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      if (Date.now() - new Date(msg.created_at).getTime() > 24 * 60 * 60 * 1000) return NextResponse.json({ error: 'More than 24 hours have passed. WhatsApp only allows free-text replies within 24 hours of the customer’s last message.' }, { status: 400 })
      const text = String(body.text || '').trim()
      if (!text) return NextResponse.json({ error: 'Type a reply first.' }, { status: 400 })
      await sendText(safe(msg.phone_ciphertext), text)
      await db.from('whatsapp_inbound').update({ handled: true }).eq('id', msg.id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'mark_handled') {
      await db.from('whatsapp_inbound').update({ handled: Boolean(body.handled ?? true) }).eq('id', String(body.id || ''))
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Something went wrong' }, { status: 500 })
  }
}
