import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Spin-to-win free gifts. Each spin wins exactly one gift, stored as a
 * single-use `free` coupon (shown as "Free item" in Admin → Coupons).
 * The gift is added automatically to the customer's next order of
 * ₹SPIN_GIFT_MIN_ORDER or more placed with the same mobile number or email.
 * It is not a discount, so it stacks with reward points and any coupon code.
 */
export const SPIN_GIFT_MIN_ORDER = 499
export const SPIN_GIFT_VALID_DAYS = 7

export type SpinGift = { label: string; product_name: string; pack_label: string; quantity: number }

export const spinGifts: SpinGift[] = [
  { label: '2 free Chicken Wings', product_name: 'Chicken Wings', pack_label: '2 pieces · free gift', quantity: 1 },
  { label: '1 free pack of Chicken Feet', product_name: 'Chicken Feet', pack_label: '1 pack · free gift', quantity: 1 },
  { label: '1 free Goat Trachea', product_name: 'Goat Trachea', pack_label: '1 piece · free gift', quantity: 1 },
]

export const giftForLabel = (label: unknown) => spinGifts.find(gift => gift.label === label) || null

export type EligibleSpinGift = { couponId: string; code: string; gift: SpinGift }

/** Latest unused, unexpired spin gift for this customer (matched by hashed phone or email). */
export async function findSpinGift(supabase: SupabaseClient, input: { phoneHash: string | null; emailHash: string | null }): Promise<EligibleSpinGift | null> {
  const filters = [input.phoneHash && `pii_phone_hash.eq.${input.phoneHash}`, input.emailHash && `pii_email_hash.eq.${input.emailHash}`].filter(Boolean)
  if (!filters.length) return null
  const { data: capture, error } = await supabase.from('email_captures')
    .select('prize,coupon_code')
    .eq('source', 'spin_to_win')
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !capture?.coupon_code) return null
  const gift = giftForLabel(capture.prize)
  if (!gift) return null
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
