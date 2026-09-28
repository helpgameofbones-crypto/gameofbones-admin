import crypto from 'crypto'

const PIXEL_ID = '2097278950833218'
const API_VERSION = 'v21.0'

type PurchaseItem = { product_name?: unknown; name?: unknown; quantity?: unknown; qty?: unknown; pack_price?: unknown; price?: unknown }

const hash = (value: string) => crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export async function sendMetaPurchase(input: {
  ref: string
  value: number
  items?: PurchaseItem[]
  email?: string
  phone?: string
  clientIp?: string | null
  userAgent?: string | null
}) {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token || !input.ref) return

  const userData: Record<string, string | string[]> = {}
  if (input.email) userData.em = [hash(input.email)]
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '')
    const normalized = digits.length === 10 ? `91${digits}` : digits
    if (normalized) userData.ph = [hash(normalized)]
  }
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.userAgent) userData.client_user_agent = input.userAgent

  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{
      event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: input.ref,
      action_source: 'website', event_source_url: 'https://gameofbones.in/', user_data: userData,
      custom_data: {
        currency: 'INR', value: Number(input.value || 0), content_type: 'product',
        contents: (input.items || []).map(item => ({
          id: String(item.product_name || item.name || ''),
          quantity: Number(item.quantity || item.qty || 1),
          item_price: Number(item.pack_price || item.price || 0),
        })),
      },
    }] }),
  })
  if (!response.ok) throw new Error(`Meta CAPI request failed (${response.status})`)
}
