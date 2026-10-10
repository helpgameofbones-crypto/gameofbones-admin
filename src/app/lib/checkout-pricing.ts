import { SupabaseClient } from '@supabase/supabase-js'

type Product = { name: string; price: unknown; compare_price: unknown; sizes: unknown; is_active: unknown; stock?: unknown }
type RequestedLine = { name?: unknown; quantity?: unknown; pack_label?: unknown; pack_price?: unknown; price?: unknown }

/** A problem the shopper can fix (bag, pack or offer code). Its message is safe to show at checkout. */
export class CheckoutError extends Error {}

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
  items: Array<{ name: string; pack_label: string; pack_weight_grams: number | null; price: number; compare_price: number; is_sale: boolean; quantity: number }>
  subtotal: number
  discount: number
  packaging: number
  grand_total: number
  coupon_code: string | null
  sale_items_present: boolean
  points_redeemed: number
  points_discount: number
  single_use_coupon_id: string | null
  coupon_uses_per_customer: number | null
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
  if (!Array.isArray(requestedItems) || !requestedItems.length || requestedItems.length > 50) throw new CheckoutError('Your bag is empty or invalid. Please refresh your bag.')
  const { data, error } = await database.from('products').select('name,price,compare_price,sizes,is_active,stock').eq('is_active', true).limit(2000)
  if (error) throw new Error('Unable to verify current product pricing.')
  const products = new Map((data || []).map((product: Product) => [cleanName(product.name), product]))
  const stockUse = new Map<string, number>()
  const items = (requestedItems as RequestedLine[]).map(line => {
    const name = cleanName(line?.name), product = products.get(name)
    const quantity = Math.min(Math.max(Math.floor(Number(line?.quantity) || 0), 1), 99)
    if (!product || !name) throw new CheckoutError('One or more treats in your bag are no longer available. Please refresh your bag.')
    const packLabel = cleanLabel(line?.pack_label)
    const packs = Array.isArray(product.sizes)
      ? product.sizes.filter((pack: unknown): pack is Record<string, unknown> => Boolean(pack) && typeof pack === 'object')
      : []
    // Match the pack by its label. Older carts sent a generic label such as
    // "Pack" for piece-based packs (e.g. Whole Quail 4 pieces), so fall back to
    // the catalogue pack whose current price equals the price shown in the bag.
    // The price charged still comes from the database pack, never the browser.
    const shownPrice = money(line?.pack_price ?? line?.price)
    const matchedPack = packs.find(pack => cleanName(pack.label) === cleanName(packLabel))
      || (shownPrice ? packs.find(pack => money(pack.price) === shownPrice) : undefined)
    // Browser carts can retain a pack label from an older catalogue version.
    // Never trust that label or its price; fall back to the current base
    // product when the label no longer exists instead of blocking checkout.
    // A one-size product does not need a client-provided label: use the
    // catalogue's canonical size so legacy carts still create useful orders.
    const selectedPack = matchedPack || (!packLabel && packs.length === 1 ? packs[0] : undefined)
    const effectivePackLabel = selectedPack ? cleanLabel(selectedPack.label) : ''
    const packWeight = selectedPack ? money(selectedPack.weight_grams) || null : null
    const price = money(selectedPack?.price ?? product.price)
    const compare_price = money(selectedPack?.compare_price ?? product.compare_price)
    if (!price) throw new CheckoutError(`Current pricing is unavailable for ${product.name}. Please remove it and add it again.`)
    // Stock is counted in base pouches: the Nth pack option uses N pouches.
    const packIndex = selectedPack ? packs.indexOf(selectedPack) : 0
    stockUse.set(product.name, (stockUse.get(product.name) || 0) + quantity * (packIndex + 1))
    return { name: product.name, pack_label: effectivePackLabel, pack_weight_grams: packWeight, price, compare_price, is_sale: compare_price > price, quantity }
  })
  stockUse.forEach((needed, productName) => {
    const raw = products.get(cleanName(productName))?.stock
    if (raw === null || raw === undefined || raw === '') return
    const available = Math.max(0, Math.floor(Number(raw) || 0))
    if (available <= 0) throw new CheckoutError(`Sorry, ${productName} is out of stock. Please remove it from your bag.`)
    if (needed > available) throw new CheckoutError(`Only ${available} ${available === 1 ? 'pouch' : 'pouches'} of ${productName} left. Please reduce it in your bag.`)
  })
  const subtotal = items.reduce((total, line) => total + line.price * line.quantity, 0)
  const itemCount = items.reduce((total, line) => total + line.quantity, 0)
  const sale_items_present = items.some(item => item.is_sale)
  // A marked-down price is final: it cannot stack with an offer code or the
  // automatic buy-more tiers. Reward points are deliberately handled below
  // and continue to work on sale baskets.
  const bulkRate = sale_items_present ? 0 : itemCount >= 10 ? .15 : itemCount >= 8 ? .12 : itemCount >= 5 ? .08 : itemCount >= 3 ? .05 : 0
  const coupon = typeof requestedCoupon === 'string' ? requestedCoupon.trim().toUpperCase() : ''
  // Sale prices are the starting price, not an exclusion. A customer may
  // still apply an eligible code and redeem points against a sale basket.
  let couponRate = coupon === 'WELCOME15' && welcomeEligible ? .15 : coupon === 'MEGA20' && subtotal >= 2199 ? .2 : 0
  let singleUseCouponId: string | null = null
  let couponUsesPerCustomer: number | null = null
  // Private offers are created in the admin coupon table and deliberately do
  // not need to be listed anywhere on the storefront.  Always validate the
  // entered code against that table instead of granting a discount merely
  // because its name matches a prefix.
  if (!couponRate && coupon) {
    const { data: singleUseCoupon, error: singleUseCouponError } = await database
      .from('coupons')
      .select('id,type,value,min_order,max_uses,uses_count,usagepercustomer,valid_from,valid_until,is_active')
      .eq('code', coupon)
      .maybeSingle()
    if (singleUseCouponError) throw new Error('Unable to verify your private offer. Please try again.')
    const today = new Date().toISOString().slice(0, 10)
    const valid = Boolean(singleUseCoupon?.is_active)
      && singleUseCoupon?.type === 'percent'
      && Number.isInteger(Number(singleUseCoupon?.value))
      && Number(singleUseCoupon?.value) > 0
      && Number(singleUseCoupon?.value) <= 100
      && Number(singleUseCoupon?.min_order || 0) <= subtotal
      && (!singleUseCoupon?.valid_from || String(singleUseCoupon.valid_from) <= today)
      && (!singleUseCoupon?.valid_until || String(singleUseCoupon.valid_until) >= today)
      && (singleUseCoupon?.max_uses == null || Number(singleUseCoupon.uses_count || 0) < Number(singleUseCoupon.max_uses))
    if (!valid) {
      if (coupon === 'WELCOME15') throw new CheckoutError('WELCOME15 is for first orders only, and this mobile number or email has ordered with us before. Remove the code to pay now, or try MEGA20 on orders of ₹2,199+.')
      if (coupon === 'MEGA20') throw new CheckoutError('MEGA20 needs a treat subtotal of ₹2,199 or more. Add a little more, or remove the code to pay now.')
      throw new CheckoutError(`The code ${coupon} is invalid, expired or not valid for this bag. Remove the code to pay now.`)
    }
    couponRate = Number(singleUseCoupon?.value) / 100
    const perCustomer = Number(singleUseCoupon?.usagepercustomer)
    couponUsesPerCustomer = Number.isInteger(perCustomer) && perCustomer > 0 ? perCustomer : null
    // Existing birthday and spin rewards are intentionally one-time offers.
    // Do not disable a normal private campaign code after its first order.
    if (Number(singleUseCoupon?.max_uses) === 1) singleUseCouponId = String(singleUseCoupon.id)
  }
  const discount = Math.round(subtotal * Math.max(bulkRate, couponRate))
  // ₹100 is the maximum reward discount per order. 333 points is ₹99.90,
  // which rounds to ₹100; the money cap below remains authoritative.
  const points_redeemed = Math.min(Math.max(Math.floor(Number(requestedPoints) || 0), 0), MAX_REDEMPTION_POINTS, Math.max(0, Math.floor(Number(availablePoints) || 0)))
  const points_discount = Math.min(MAX_POINTS_DISCOUNT_RUPEES, Math.round(points_redeemed * POINT_VALUE_RUPEES))
  const cod = paymentMethod === 'cod'
  const packaging = cod ? 40 : 0
  const onlineSaving = cod ? 0 : 30
  return { items, subtotal, discount, packaging, points_redeemed, points_discount, single_use_coupon_id: singleUseCouponId, coupon_uses_per_customer: couponUsesPerCustomer, grand_total: Math.max(1, subtotal - discount - points_discount + packaging - onlineSaving), coupon_code: couponRate ? coupon : null, sale_items_present }
}
