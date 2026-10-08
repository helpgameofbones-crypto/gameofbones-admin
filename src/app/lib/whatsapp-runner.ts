import { randomBytes } from 'node:crypto'
import { decryptPii, revealLegacyPii } from '@/app/lib/pii-crypto'
import { canSend, db, getSettings, sendTemplate } from '@/app/lib/whatsapp'

/**
 * WhatsApp automation runner. Called every 15 minutes by Supabase pg_cron
 * (job "whatsapp-runner", header x-whatsapp-cron-key) and by the admin
 * "Run now" button. Does nothing unless WhatsApp is configured and switched on.
 *
 * Only customers who opted in to WhatsApp are messaged:
 *  - carts: whatsapp_opt_in = true (cart "save my bag" form or checkout tick box)
 *  - orders: whatsapp_opt_in = true (checkout tick box)
 */
const firstName = (value: string) => (value || '').trim().split(/\s+/)[0]?.slice(0, 30) || 'there'
const reveal = (cipher: unknown, legacy: unknown) => {
  try { return decryptPii(typeof cipher === 'string' ? cipher : null) || revealLegacyPii(legacy) } catch { try { return revealLegacyPii(legacy) } catch { return '' } }
}
const money = (n: unknown) => Math.round(Number(n) || 0).toLocaleString('en-IN')

type CartRow = {
  id: string; abandoned_at: string; total: number; items: unknown; coupon_code: string | null
  customer_phone: string | null; customer_name: string | null; pii_phone_ciphertext: string | null; pii_name_ciphertext: string | null
  pii_phone_hash: string | null; pii_email_hash: string | null; restore_token: string | null
  wa_reminder1_at: string | null; wa_reminder2_at: string | null; recovered: boolean
}

async function hasOrderedSince(cart: CartRow) {
  const hashes = [cart.pii_phone_hash ? `pii_phone_hash.eq.${cart.pii_phone_hash}` : '', cart.pii_email_hash ? `pii_email_hash.eq.${cart.pii_email_hash}` : ''].filter(Boolean)
  if (!hashes.length) return false
  const since = new Date(new Date(cart.abandoned_at).getTime() - 15 * 60 * 1000).toISOString()
  const { data, error } = await db.from('orders').select('status').or(hashes.join(',')).gte('created_at', since).limit(10)
  if (error) return true // cannot check → do not message
  return (data || []).some((o: { status?: string | null }) => o.status !== 'pending_payment' && !/^cancel/i.test(String(o.status || '')))
}

function itemSummary(items: unknown) {
  const list = Array.isArray(items) ? items as Record<string, unknown>[] : []
  const parts = list.slice(0, 4).map(item => `${String(item.name || 'Treat').slice(0, 40)} × ${Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1)}`)
  if (list.length > 4) parts.push(`+${list.length - 4} more`)
  return parts.join(', ') || 'Your treats'
}

async function ensureRestoreToken(cart: CartRow) {
  if (cart.restore_token) return cart.restore_token
  const token = randomBytes(12).toString('base64url')
  await db.from('abandoned_carts').update({ restore_token: token }).eq('id', cart.id)
  return token
}

async function runCartReminders(settings: Awaited<ReturnType<typeof getSettings>>) {
  const out = { reminder1: 0, reminder2: 0, skipped: 0 }
  const now = Date.now()
  const enabledAt = settings.enabled_at ? new Date(settings.enabled_at).getTime() : now
  const r1Delay = settings.reminder1_delay_minutes * 60 * 1000
  const r2Delay = settings.reminder2_delay_hours * 60 * 60 * 1000
  // Only carts left after WhatsApp was switched on (and at most 3 days old).
  const oldest = new Date(Math.max(enabledAt, now - 3 * 24 * 60 * 60 * 1000)).toISOString()

  const { data } = await db.from('abandoned_carts')
    .select('id,abandoned_at,total,items,coupon_code,customer_phone,customer_name,pii_phone_ciphertext,pii_name_ciphertext,pii_phone_hash,pii_email_hash,restore_token,wa_reminder1_at,wa_reminder2_at,recovered')
    .eq('whatsapp_opt_in', true).eq('recovered', false)
    .gte('abandoned_at', oldest)
    .lte('abandoned_at', new Date(now - r1Delay).toISOString())
    .or('wa_reminder1_at.is.null,wa_reminder2_at.is.null')
    .limit(100)

  for (const cart of (data || []) as CartRow[]) {
    const age = now - new Date(cart.abandoned_at).getTime()
    const step = !cart.wa_reminder1_at ? 1 : (!cart.wa_reminder2_at && age >= r2Delay && now - new Date(cart.wa_reminder1_at).getTime() >= 6 * 60 * 60 * 1000) ? 2 : 0
    if (!step) continue
    if (await hasOrderedSince(cart)) { await db.from('abandoned_carts').update({ recovered: true }).eq('id', cart.id); out.skipped++; continue }
    const phone = reveal(cart.pii_phone_ciphertext, cart.customer_phone)
    const name = firstName(reveal(cart.pii_name_ciphertext, cart.customer_name))
    const token = await ensureRestoreToken(cart)
    // Mark first so an overlapping run can never send the same reminder twice.
    const column = step === 1 ? 'wa_reminder1_at' : 'wa_reminder2_at'
    const { data: claimed } = await db.from('abandoned_carts').update({ [column]: new Date().toISOString() }).eq('id', cart.id).is(column, null).select('id')
    if (!claimed?.length) continue
    const result = step === 1
      ? await sendTemplate({ kind: 'cart_reminder_1', phone, cartId: cart.id }, 'gob_cart_reminder_1', [name, itemSummary(cart.items), money(cart.total)], token)
      : cart.coupon_code
        ? await sendTemplate({ kind: 'cart_reminder_2', phone, cartId: cart.id }, 'gob_cart_reminder_2', [name, cart.coupon_code, /^SAVE10/i.test(cart.coupon_code) ? '10%' : 'a special discount'], `${token}.c`)
        : { ok: false as const, reason: 'no_coupon' }
    if (!result.ok) out.skipped++
    else if (step === 1) out.reminder1++
    else out.reminder2++
  }
  return out
}

type OrderRow = {
  id: string; ref: string | null; order_ref: string | null; status: string | null; payment_method: string | null; grand_total: number
  created_at: string; delivered_at: string | null; delhivery_awb: string | null
  customer_phone: string | null; customer_name: string | null; pii_phone_ciphertext: string | null; pii_name_ciphertext: string | null
  wa_confirmed_at: string | null; wa_shipped_at: string | null; wa_delivered_at: string | null
}

async function claim(orderId: string, column: string) {
  const { data } = await db.from('orders').update({ [column]: new Date().toISOString() }).eq('id', orderId).is(column, null).select('id')
  return Boolean(data?.length)
}

async function runOrderUpdates(settings: Awaited<ReturnType<typeof getSettings>>) {
  const out = { confirmed: 0, shipped: 0, delivered: 0, skipped: 0 }
  const enabledAt = settings.enabled_at || new Date().toISOString()
  const { data } = await db.from('orders')
    .select('id,ref,order_ref,status,payment_method,grand_total,created_at,delivered_at,delhivery_awb,customer_phone,customer_name,pii_phone_ciphertext,pii_name_ciphertext,wa_confirmed_at,wa_shipped_at,wa_delivered_at')
    .eq('whatsapp_opt_in', true)
    .gte('created_at', enabledAt)
    .gte('created_at', new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString())
    .or('wa_confirmed_at.is.null,wa_shipped_at.is.null,wa_delivered_at.is.null')
    .limit(150)

  for (const order of (data || []) as OrderRow[]) {
    const status = String(order.status || '')
    if (status === 'pending_payment' || /^cancel|return/i.test(status)) continue
    const phone = reveal(order.pii_phone_ciphertext, order.customer_phone)
    const name = firstName(reveal(order.pii_name_ciphertext, order.customer_name))
    const ref = order.ref || order.order_ref || ''
    const meta = { phone, orderId: order.id, orderRef: ref }
    const delivered = status === 'delivered' || Boolean(order.delivered_at)
    const shipped = delivered || ['shipped', 'dispatched', 'in_transit', 'out_for_delivery'].includes(status)

    if (!order.wa_confirmed_at && !shipped && await claim(order.id, 'wa_confirmed_at')) {
      const r = await sendTemplate({ kind: 'order_confirmed', ...meta }, 'gob_order_confirmed', [name, ref, money(order.grand_total), order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'], ref)
      if (r.ok) out.confirmed++; else out.skipped++
    }
    if (shipped && !order.wa_shipped_at && !delivered && order.delhivery_awb && await claim(order.id, 'wa_shipped_at')) {
      const r = await sendTemplate({ kind: 'order_shipped', ...meta }, 'gob_order_shipped', [name, ref, order.delhivery_awb], ref)
      if (r.ok) out.shipped++; else out.skipped++
    }
    if (delivered && !order.wa_delivered_at && await claim(order.id, 'wa_delivered_at')) {
      // Never send "shipped" after "delivered".
      if (!order.wa_shipped_at) await db.from('orders').update({ wa_shipped_at: new Date().toISOString() }).eq('id', order.id).is('wa_shipped_at', null)
      const r = await sendTemplate({ kind: 'order_delivered', ...meta }, 'gob_order_delivered', [name, ref])
      if (r.ok) out.delivered++; else out.skipped++
    }
  }
  return out
}

export async function runAll(settings: Awaited<ReturnType<typeof getSettings>>) {
  let result: Record<string, unknown>
  if (!settings.enabled) result = { status: 'off' }
  else if (!canSend()) result = { status: 'not_configured' }
  else {
    const carts = settings.cart_reminders ? await runCartReminders(settings) : 'off'
    const orders = settings.order_updates ? await runOrderUpdates(settings) : 'off'
    result = { status: 'ok', carts, orders }
  }
  await db.from('whatsapp_settings').update({ last_run_at: new Date().toISOString(), last_run_result: result }).eq('id', 1)
  return result
}
