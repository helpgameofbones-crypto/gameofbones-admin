import crypto from 'crypto'

const PIXEL_ID = '2097278950833218'
const API_VERSION = 'v21.0'
const DEFAULT_SOURCE_URL = 'https://gameofbones.in/checkout'

type PurchaseItem = { catalog_id?: unknown; product_name?: unknown; name?: unknown; quantity?: unknown; qty?: unknown; pack_price?: unknown; price?: unknown }

/** Browser signals collected at checkout. Every field is optional and untrusted. */
export type MetaBrowserSignals = {
  fbp?: unknown
  fbc?: unknown
  event_source_url?: unknown
  client_user_agent?: unknown
}

const hash = (value: string) => crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
const catalogSlug = (value: unknown) => String(value || '')
  .replace(/\s+—\s+.+$/, '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
const catalogId = (item: PurchaseItem) => catalogSlug(item.catalog_id || item.product_name || item.name)

// Meta's documented formats: fb.<subdomainIndex>.<creationTime>.<random/fbclid>.
// Anything else is dropped rather than forwarded.
const FBP_RE = /^fb\.[0-2]\.\d{10,13}\.\d{5,20}$/
const FBC_RE = /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_-]{10,500}$/
const cleanString = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const cleanFbp = (value: unknown) => { const v = cleanString(value, 80); return FBP_RE.test(v) ? v : '' }
const cleanFbc = (value: unknown) => { const v = cleanString(value, 600); return FBC_RE.test(v) ? v : '' }
const cleanSourceUrl = (value: unknown) => {
  const raw = cleanString(value, 500)
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !['gameofbones.in', 'www.gameofbones.in'].includes(url.hostname)) return DEFAULT_SOURCE_URL
    // Never forward query strings: they can carry fbclid, coupon codes or other identifiers.
    return `${url.origin}${url.pathname}`
  } catch { return DEFAULT_SOURCE_URL }
}
// Normalisation rules from Meta's customer-information parameter guide.
const normName = (value: unknown) => cleanString(value, 80).toLowerCase().replace(/[^\p{L}]/gu, '')
const normCity = (value: unknown) => cleanString(value, 80).toLowerCase().replace(/[^a-z]/g, '')
const normState = (value: unknown) => cleanString(value, 80).toLowerCase().replace(/[^a-z]/g, '')
const normZip = (value: unknown) => cleanString(value, 12).replace(/\s/g, '').toLowerCase()

export async function sendMetaPurchase(input: {
  ref: string
  value: number
  items?: PurchaseItem[]
  email?: string
  phone?: string
  name?: string
  city?: string
  state?: string
  pincode?: string
  clientIp?: string | null
  userAgent?: string | null
  browser?: MetaBrowserSignals | null
}) {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token || !input.ref) return

  const userData: Record<string, string | string[]> = {}
  if (input.email) userData.em = [hash(input.email)]
  let normalizedPhone = ''
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '')
    normalizedPhone = digits.length === 10 ? `91${digits}` : digits
    if (normalizedPhone) userData.ph = [hash(normalizedPhone)]
  }
  // A stable, hashed customer key lets Meta join repeat purchases to the same person.
  if (normalizedPhone) userData.external_id = [hash(normalizedPhone)]
  const nameParts = cleanString(input.name, 160).split(/\s+/).filter(Boolean)
  const fn = normName(nameParts[0]), ln = normName(nameParts.length > 1 ? nameParts[nameParts.length - 1] : '')
  if (fn) userData.fn = [hash(fn)]
  if (ln) userData.ln = [hash(ln)]
  const ct = normCity(input.city), st = normState(input.state), zp = normZip(input.pincode)
  if (ct) userData.ct = [hash(ct)]
  if (st) userData.st = [hash(st)]
  if (/^\d{6}$/.test(zp)) userData.zp = [hash(zp)]
  if (ct || st || zp || normalizedPhone.startsWith('91')) userData.country = [hash('in')]

  const browser = input.browser || {}
  const fbp = cleanFbp(browser.fbp), fbc = cleanFbc(browser.fbc)
  if (fbp) userData.fbp = fbp
  if (fbc) userData.fbc = fbc
  if (input.clientIp) userData.client_ip_address = input.clientIp
  const userAgent = input.userAgent || cleanString(browser.client_user_agent, 400)
  if (userAgent) userData.client_user_agent = userAgent

  const contents = (input.items || []).map(item => ({
    id: catalogId(item),
    quantity: Number(item.quantity || item.qty || 1),
    item_price: Number(item.pack_price || item.price || 0),
  })).filter(item => item.id)

  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{
      event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: input.ref,
      action_source: 'website', event_source_url: cleanSourceUrl(browser.event_source_url), user_data: userData,
      custom_data: {
        currency: 'INR', value: Number(input.value || 0), content_type: 'product', order_id: input.ref,
        content_ids: contents.map(item => item.id),
        contents,
      },
    }] }),
  })
  if (!response.ok) throw new Error(`Meta CAPI request failed (${response.status})`)
}

/** Razorpay notes are flat strings; read the checkout's Meta signals back out of them. */
export function metaSignalsFromNotes(notes: Record<string, unknown> | undefined | null) {
  const n = notes || {}
  const geo = cleanString(n.ship_geo, 200).split('|')
  return {
    browser: { fbp: n.meta_fbp, fbc: n.meta_fbc, event_source_url: n.meta_url, client_user_agent: n.meta_ua } as MetaBrowserSignals,
    clientIp: cleanString(n.meta_ip, 60) || null,
    name: cleanString(n.customer_name, 160),
    city: geo[0] || '', state: geo[1] || '', pincode: geo[2] || '',
  }
}

/** Best-effort client IP from proxy headers (the storefront proxies /api through Vercel). */
export function clientIpFromRequest(headers: Headers) {
  const candidate = headers.get('x-forwarded-for') || headers.get('x-real-ip') || headers.get('x-vercel-forwarded-for') || ''
  const ip = candidate.split(',')[0]?.trim() || ''
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null
}
