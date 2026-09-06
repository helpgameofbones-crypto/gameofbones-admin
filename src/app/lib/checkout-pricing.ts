import { SupabaseClient } from '@supabase/supabase-js'

type Product = { name: string; price: unknown; is_active: unknown }
type RequestedLine = { name?: unknown; quantity?: unknown; pack_label?: unknown }

const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const cleanLabel = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 100) : ''
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
): Promise<CheckoutQuote> {
  if (!Array.isArray(requestedItems) || !requestedItems.length || requestedItems.length > 50) throw new Error('Your bag is empty or invalid.')
  const { data, error } = await database.from('products').select('name,price,is_active').eq('is_active', true).limit(2000)
  if (error) throw new Error('Unable to verify current product pricing.')
  const products = new Map((data || []).map((product: Product) => [cleanName(product.name), product]))
  const items = (requestedItems as RequestedLine[]).map(line => {
    const name = cleanName(line?.name), product = products.get(name)
    const quantity = Math.min(Math.max(Math.floor(Number(line?.quantity) || 0), 1), 99)
    if (!product || !name) throw new Error('One or more treats in your bag are no longer available. Please refresh your bag.')
    const price = money(product.price)
    if (!price) throw new Error(`Current pricing is unavailable for ${product.name}.`)
    return { name: product.name, pack_label: cleanLabel(line?.pack_label), price, quantity }
  })
  const subtotal = items.reduce((total, line) => total + line.price * line.quantity, 0)
  const itemCount = items.reduce((total, line) => total + line.quantity, 0)
  const bulkRate = itemCount >= 10 ? .15 : itemCount >= 8 ? .12 : itemCount >= 5 ? .08 : itemCount >= 3 ? .05 : 0
  const coupon = typeof requestedCoupon === 'string' ? requestedCoupon.trim().toUpperCase() : ''
  const couponRate = coupon === 'WELCOME15' && welcomeEligible ? .15 : coupon === 'MEGA20' && subtotal >= 2199 ? .2 : 0
  const discount = Math.round(subtotal * Math.max(bulkRate, couponRate))
  const cod = paymentMethod === 'cod'
  const packaging = cod ? 40 : 0
  const onlineSaving = cod ? 0 : 30
  return { items, subtotal, discount, packaging, grand_total: Math.max(1, subtotal - discount + packaging - onlineSaving), coupon_code: couponRate ? coupon : null }
}
