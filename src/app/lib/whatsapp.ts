import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

/**
 * WhatsApp Cloud API (Meta, direct, no middleman).
 *
 * Required environment variables (set in Vercel → Settings → Environment Variables):
 *   WHATSAPP_ACCESS_TOKEN          permanent System User token with whatsapp_business_messaging
 *                                  and whatsapp_business_management permissions
 *   WHATSAPP_PHONE_NUMBER_ID       the sending number's ID (WhatsApp Manager → API setup)
 *   WHATSAPP_BUSINESS_ACCOUNT_ID   the WhatsApp Business Account (WABA) ID
 *   WHATSAPP_APP_SECRET            Meta app secret, used to verify webhook signatures
 *   WHATSAPP_VERIFY_TOKEN          any random string; paste the same value in the Meta webhook form
 * Optional:
 *   WHATSAPP_GRAPH_VERSION         defaults to v23.0
 */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'}`
export const SITE = 'https://gameofbones.in'
export const ADMIN_BASE = 'https://gameofbones-admin.vercel.app'

export function whatsappEnv() {
  return {
    token: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    businessAccountId: Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
  }
}
export function canSend() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export type WhatsappSettings = {
  enabled: boolean
  cart_reminders: boolean
  order_updates: boolean
  reminder1_delay_minutes: number
  reminder2_delay_hours: number
  enabled_at: string | null
  cron_key: string
  last_run_at: string | null
  last_run_result: unknown
  last_webhook_at: string | null
}
export async function getSettings(): Promise<WhatsappSettings> {
  const { data, error } = await db.from('whatsapp_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data as WhatsappSettings
}

/** Indian mobile → E.164 digits without "+", e.g. 919876543210. */
export function toWaNumber(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  return /^[6-9]\d{9}$/.test(local) ? `91${local}` : null
}
export function phoneHashOf(raw: string): string | null {
  return piiHash(normalizePhoneForHash(raw))
}

async function graph(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = body?.error?.error_user_msg || body?.error?.message || `Meta API error ${res.status}`
    throw Object.assign(new Error(message), { code: body?.error?.code, status: res.status })
  }
  return body
}

/* ------------------------------------------------------------------ */
/* Message templates. Meta must approve these before they can be sent. */
/* ------------------------------------------------------------------ */
type TemplateDef = {
  name: string
  category: 'MARKETING' | 'UTILITY'
  purpose: string
  body: string
  example: string[]
  button?: { text: string; urlBase: string; example: string }
}
export const TEMPLATES: TemplateDef[] = [
  {
    name: 'gob_cart_reminder_1',
    category: 'MARKETING',
    purpose: 'Cart reminder #1 (sent about 1 hour after a cart is left)',
    body: 'Hi {{1}}, your pup’s treats are still waiting in your bag 🐾\n\n{{2}}\nTotal: ₹{{3}}\n\nTap below to pick up right where you left off. Not sure what to choose? Just reply here and we’ll help.',
    example: ['Priya', 'Chicken Jerky × 1, Goat Trotter × 2', '779'],
    button: { text: 'Complete my order', urlBase: `${SITE}/cart?restore=`, example: 'abc123' },
  },
  {
    name: 'gob_cart_reminder_2',
    category: 'MARKETING',
    purpose: 'Cart reminder #2 (sent about 24 hours later, with the cart’s coupon)',
    body: 'Hi {{1}}, still thinking it over? Your bag is saved for you.\n\nUse code {{2}} at checkout for {{3}} off — valid for the next 24 hours. Free shipping on every order.',
    example: ['Priya', 'SAVE10-AB12C', '10%'],
    button: { text: 'Return to my bag', urlBase: `${SITE}/cart?restore=`, example: 'abc123' },
  },
  {
    name: 'gob_order_confirmed',
    category: 'UTILITY',
    purpose: 'Order confirmation',
    body: 'Hi {{1}}, thank you for your order {{2}} 🐾\n\nAmount: ₹{{3}} ({{4}})\n\nWe’re packing it now and will message you here as soon as it ships.',
    example: ['Priya', 'GOB-ABC123', '1,199', 'Paid online'],
    button: { text: 'Track order', urlBase: `${SITE}/track?ref=`, example: 'GOB-ABC123' },
  },
  {
    name: 'gob_order_shipped',
    category: 'UTILITY',
    purpose: 'Order shipped',
    body: 'Hi {{1}}, your order {{2}} has shipped with Delhivery 🚚\n\nTracking number (AWB): {{3}}\n\nTap below to follow your parcel.',
    example: ['Priya', 'GOB-ABC123', '1234567890123'],
    button: { text: 'Track order', urlBase: `${SITE}/track?ref=`, example: 'GOB-ABC123' },
  },
  {
    name: 'gob_order_delivered',
    category: 'UTILITY',
    purpose: 'Order delivered',
    body: 'Hi {{1}}, your order {{2}} has been delivered.\n\nIf anything is not right with your order, reply to this message and we’ll sort it out.',
    example: ['Priya', 'GOB-ABC123'],
  },
]
export const TEMPLATE_LANGUAGE = 'en'

export async function listMetaTemplates() {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  if (!waba || !process.env.WHATSAPP_ACCESS_TOKEN) return null
  const body = await graph(`${waba}/message_templates?fields=name,status,category,language,rejected_reason&limit=200`)
  return (body.data || []) as { name: string; status: string; category: string; language: string; rejected_reason?: string }[]
}

export async function submitTemplate(def: TemplateDef) {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  if (!waba) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not set')
  const components: Record<string, unknown>[] = [
    { type: 'BODY', text: def.body, example: { body_text: [def.example] } },
    { type: 'FOOTER', text: 'Game of Bones · Reply STOP to opt out' },
  ]
  if (def.category === 'UTILITY') components[1] = { type: 'FOOTER', text: 'Game of Bones' }
  if (def.button) components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: def.button.text, url: `${def.button.urlBase}{{1}}`, example: [`${def.button.urlBase}${def.button.example}`] }] })
  return graph(`${waba}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: def.name, language: TEMPLATE_LANGUAGE, category: def.category, components }),
  })
}

export async function phoneNumberInfo() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!id || !process.env.WHATSAPP_ACCESS_TOKEN) return null
  return graph(`${id}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type,throughput`)
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */
export type SendMeta = { kind: string; phone: string; cartId?: string | null; orderId?: string | null; orderRef?: string | null }

async function isOptedOut(phoneHash: string | null) {
  if (!phoneHash) return false
  const { data } = await db.from('whatsapp_optouts').select('phone_hash').eq('phone_hash', phoneHash).maybeSingle()
  return Boolean(data)
}

async function logMessage(meta: SendMeta, fields: Record<string, unknown>) {
  const digits = String(meta.phone || '').replace(/\D/g, '')
  await db.from('whatsapp_messages').insert({
    kind: meta.kind,
    phone_hash: phoneHashOf(meta.phone),
    phone_last4: digits.slice(-4) || null,
    cart_id: meta.cartId || null,
    order_id: meta.orderId || null,
    order_ref: meta.orderRef || null,
    ...fields,
  })
}

/** Send an approved template. Never throws; returns the outcome and logs it. */
export async function sendTemplate(meta: SendMeta, templateName: string, bodyParams: string[], buttonParam?: string, opts: { ignoreOptOut?: boolean } = {}) {
  const to = toWaNumber(meta.phone)
  const def = TEMPLATES.find(t => t.name === templateName)
  const category = def?.category || (templateName === 'hello_world' ? 'UTILITY' : null)
  if (!to) return { ok: false as const, reason: 'invalid_number' }
  if (!canSend()) return { ok: false as const, reason: 'not_configured' }
  if (!opts.ignoreOptOut && await isOptedOut(phoneHashOf(meta.phone))) {
    await logMessage(meta, { template: templateName, category, status: 'skipped', error: 'Customer opted out (STOP)' })
    return { ok: false as const, reason: 'opted_out' }
  }
  const components: Record<string, unknown>[] = []
  if (bodyParams.length) components.push({ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text: String(text).slice(0, 900) || '-' })) })
  if (buttonParam) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: buttonParam }] })
  try {
    const body = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: templateName === 'hello_world' ? 'en_US' : TEMPLATE_LANGUAGE }, ...(components.length ? { components } : {}) },
      }),
    })
    const wamid = body?.messages?.[0]?.id || null
    await logMessage(meta, { template: templateName, category, wamid, status: 'sent', status_at: new Date().toISOString() })
    return { ok: true as const, wamid }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed'
    await logMessage(meta, { template: templateName, category, status: 'failed', error: message.slice(0, 500) })
    return { ok: false as const, reason: message }
  }
}

/** Free-text reply. Only allowed within 24h of the customer's last message. */
export async function sendText(phone: string, text: string) {
  const to = toWaNumber(phone)
  if (!to) throw new Error('Invalid number')
  const body = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: false } }),
  })
  const wamid = body?.messages?.[0]?.id || null
  await logMessage({ kind: 'reply', phone }, { template: null, category: 'SERVICE', wamid, status: 'sent', status_at: new Date().toISOString() })
  return wamid
}

/* ------------------------------------------------------------------ */
/* Webhook signature                                                   */
/* ------------------------------------------------------------------ */
export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'))
  const given = Buffer.from(header.slice(7))
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Rough per-message cost in ₹ for India (Meta rate card, 2026; check Meta for exact rates). */
export const ESTIMATED_COST_INR: Record<string, number> = { MARKETING: 0.86, UTILITY: 0.15, SERVICE: 0 }
