import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Free-gift prizes (Bone Run game, and the older spin-to-win wheel). Each
 * customer holds at most one gift, stored as a single-use `free` coupon
 * (shown as "Free item" in Admin → Coupons). The gift is added automatically
 * to the customer's next order of ₹SPIN_GIFT_MIN_ORDER or more placed with the
 * same mobile number or email. It is a free item, not a discount, so it
 * stacks with coupon codes and reward points.
 */
export const SPIN_GIFT_MIN_ORDER = 499
export const SPIN_GIFT_VALID_DAYS = 7

export type GiftLine = { product_name: string; pack_label: string; quantity: number }
export type SpinGift = { label: string; product_name: string; pack_label: string; quantity: number; rank: number; min_order: number
  /** Several free items in one prize (Bone Run grand prize). */
  items?: GiftLine[]
  /** Minimum is checked on the treat value after coupon discounts. */
  min_after_discount?: boolean }

/** The free order lines a prize adds at ₹0. */
export const giftLines = (gift: SpinGift): GiftLine[] => gift.items?.length ? gift.items : [{ product_name: gift.product_name, pack_label: gift.pack_label, quantity: gift.quantity }]

// Legacy spin-wheel prizes (kept so gifts already won are still honoured).
export const spinGifts: SpinGift[] = [
  { label: '2 free Chicken Wings', product_name: 'Chicken Wings', pack_label: '2 pieces · free gift', quantity: 1, rank: 1, min_order: SPIN_GIFT_MIN_ORDER },
  { label: '1 free pack of Chicken Feet', product_name: 'Chicken Feet', pack_label: '1 pack · free gift', quantity: 1, rank: 2, min_order: SPIN_GIFT_MIN_ORDER },
  { label: '1 free Goat Trachea', product_name: 'Goat Trachea', pack_label: '1 piece · free gift', quantity: 1, rank: 1, min_order: SPIN_GIFT_MIN_ORDER },
]

// Bone Run milestones. The customer keeps the highest one they reach.
// Tier 1 (Goat Trachea) comes free with any order; tiers 2 and 3 need ₹499+.
export const BONE_RUN_MAX_SCORE = 20000
export const BONE_RUN_GRAND_PRIZE_MIN = 2500
export const boneRunTiers: Array<SpinGift & { at: number }> = [
  { at: 800, label: '2 free Goat Trachea', product_name: 'Goat Trachea', pack_label: '2 Pieces · free gift', quantity: 1, rank: 1.5, min_order: 0 },
  { at: 2500, label: '1 free pack of Chicken Feet (70 g)', product_name: 'Chicken Feet', pack_label: '70g · free gift', quantity: 1, rank: 2.5, min_order: SPIN_GIFT_MIN_ORDER },
  { at: 5000, label: '1 free pack of Mackerel Fillet (60 g)', product_name: 'Mackerel Fillet', pack_label: '60g · free gift', quantity: 1, rank: 3, min_order: SPIN_GIFT_MIN_ORDER },
  // Grand prize: all three treats free on an order of ₹2,500+ (after coupon discounts).
  { at: 20000, label: 'All 3 treats free: 2 Goat Trachea, Chicken Feet 70 g & Mackerel Fillet 60 g', product_name: 'Goat Trachea', pack_label: '2 Pieces · free gift', quantity: 1, rank: 4, min_order: BONE_RUN_GRAND_PRIZE_MIN, min_after_discount: true,
    items: [
      { product_name: 'Goat Trachea', pack_label: '2 Pieces · free gift', quantity: 1 },
      { product_name: 'Chicken Feet', pack_label: '70g · free gift', quantity: 1 },
      { product_name: 'Mackerel Fillet', pack_label: '60g · free gift', quantity: 1 },
    ] },
]
export const boneRunTierForScore = (score: number) => [...boneRunTiers].reverse().find(tier => score >= tier.at) || null

export const giftForLabel = (label: unknown) => boneRunTiers.find(gift => gift.label === label) || spinGifts.find(gift => gift.label === label) || null

export type EligibleSpinGift = { couponId: string; code: string; gift: SpinGift }

/** Latest unused, unexpired spin gift for this customer (matched by hashed phone or email). */
export async function findSpinGift(supabase: SupabaseClient, input: { phoneHash: string | null; emailHash: string | null; subtotal?: number; netSubtotal?: number }): Promise<EligibleSpinGift | null> {
  const filters = [input.phoneHash && `pii_phone_hash.eq.${input.phoneHash}`, input.emailHash && `pii_email_hash.eq.${input.emailHash}`].filter(Boolean)
  if (!filters.length) return null
  const { data: capture, error } = await supabase.from('email_captures')
    .select('prize,coupon_code')
    .in('source', ['spin_to_win', 'bone_run'])
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !capture?.coupon_code) return null
  const gift = giftForLabel(capture.prize)
  if (!gift) return null
  // Each prize has its own minimum order (Goat Trachea: none).
  const basis = gift.min_after_discount && input.netSubtotal !== undefined ? input.netSubtotal : input.subtotal
  if (basis !== undefined && basis < gift.min_order) return null
  const today = new Date().toISOString().slice(0, 10)
  const { data: coupon } = await supabase.from('coupons')
    .select('id,code,type,uses_count,max_uses,valid_until,is_active')
    .eq('code', capture.coupon_code)
    .maybeSingle()
  if (!coupon || coupon.type !== 'free' || coupon.is_active !== true) return null
  if (Number(coupon.uses_count || 0) >= Number(coupon.max_uses || 1)) return null
  if (coupon.valid_until && String(coupon.valid_until).slice(0, 10) < today) return null
  return { couponId: String(coupon.id), code: String(coupon.code), gift }
}

/** Atomically claims the gift. Returns false if another order already used it. */
export async function claimSpinGift(supabase: SupabaseClient, couponId: string) {
  const { data, error } = await supabase.from('coupons')
    .update({ uses_count: 1, is_active: false })
    .eq('id', couponId)
    .eq('uses_count', 0)
    .eq('is_active', true)
    .select('id')
  return !error && Array.isArray(data) && data.length === 1
}

/** Gives the gift back if the order could not be saved after claiming it. */
export async function releaseSpinGift(supabase: SupabaseClient, couponId: string) {
  await supabase.from('coupons').update({ uses_count: 0, is_active: true }).eq('id', couponId).eq('uses_count', 1)
}
