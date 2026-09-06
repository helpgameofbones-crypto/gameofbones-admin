import { SupabaseClient } from '@supabase/supabase-js'

type Product = { name: string; price: unknown; sizes: unknown; is_active: unknown }
type RequestedLine = { name?: unknown; quantity?: unknown; pack_label?: unknown }

const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const cleanLabel = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 100) : ''
const POINT_VALUE_RUPEES = .3
const MAX_POINTS_DISCOUNT_RUPEES = 100
const MAX_REDEMPTION_POINTS = Math.floor(MAX_POINTS_DISCOUNT_RUPEES / POINT_VALUE_RUPEES)
const money = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0
}

export type CheckoutQuote = {
  items: Array<{ name: string; pack_label: string; price: number; quantity: number }>
  subtotal: number
  discount: number
  packaging: number
  grand_total: number
  coupon_code: string | null
  points_redeemed: number
  points_discount: number
}

// The browser may display a quote, but it must never be allowed to set the
// price, discount, or final amount. This helper only trusts active product
// records in Supabase and is used for both Razorpay and COD order saves.
export async function checkoutQuote(
  database: SupabaseClient,
  requestedItems: unknown,
  paymentMethod: unknown,
  requestedCoupon: unknown,
  welcomeEligible = false,
  availablePoints = 0,
  requestedPoints = 0,
): Promise<CheckoutQuote> {
  if (!Array.isArray(requestedItems) || !requestedItems.length || requestedItems.length > 50) throw new Error('Your bag is empty or invalid.')
  const { data, error } = await database.from('products').select('name,price,sizes,is_active').eq('is_active', true).limit(2000)
  if (error) throw new Error('Unable to verify current product pricing.')
  const products = new Map((data || []).map((product: Product) => [cleanName(product.name), product]))
  const items = (requestedItems as RequestedLine[]).map(line => {
    const name = cleanName(line?.name), product = products.get(name)
    const quantity = Math.min(Math.max(Math.floor(Number(line?.quantity) || 0), 1), 99)
    if (!product || !name) throw new Error('One or more treats in your bag are no longer available. Please refresh your bag.')
    const packLabel = cleanLabel(line?.pack_label)
    const matchedPack = Array.isArray(product.sizes)
      ? product.sizes.find((pack: unknown) => pack && typeof pack === 'object' && cleanName((pack as Record<string, unknown>).label) === cleanName(packLabel)) as Record<string, unknown> | undefined
      : undefined
    if (packLabel && !matchedPack) throw new Error(`The selected pack for ${product.name} has changed. Please refresh your bag and select it again.`)
    const price = money(matchedPack?.price ?? product.price)
    if (!price) throw new Error(`Current pricing is unavailable for ${product.name}.`)
    return { name: product.name, pack_label: packLabel, price, quantity }
  })
  const subtotal = items.reduce((total, line) => total + line.price * line.quantity, 0)
  const itemCount = items.reduce((total, line) => total + line.quantity, 0)
  const bulkRate = itemCount >= 10 ? .15 : itemCount >= 8 ? .12 : itemCount >= 5 ? .08 : itemCount >= 3 ? .05 : 0
  const coupon = typeof requestedCoupon === 'string' ? requestedCoupon.trim().toUpperCase() : ''
  const couponRate = coupon === 'WELCOME15' && welcomeEligible ? .15 : coupon === 'MEGA20' && subtotal >= 2199 ? .2 : 0
  const discount = Math.round(subtotal * Math.max(bulkRate, couponRate))
  // ₹100 is the maximum reward discount per order. 333 points is ₹99.90,
  // which rounds to ₹100; the money cap below remains authoritative.
  const points_redeemed = Math.min(Math.max(Math.floor(Number(requestedPoints) || 0), 0), MAX_REDEMPTION_POINTS, Math.max(0, Math.floor(Number(availablePoints) || 0)))
  const points_discount = Math.min(MAX_POINTS_DISCOUNT_RUPEES, Math.round(points_redeemed * POINT_VALUE_RUPEES))
  const cod = paymentMethod === 'cod'
  const packaging = cod ? 40 : 0
  const onlineSaving = cod ? 0 : 30
  return { items, subtotal, discount, packaging, points_redeemed, points_discount, grand_total: Math.max(1, subtotal - discount - points_discount + packaging - onlineSaving), coupon_code: couponRate ? coupon : null }
}
