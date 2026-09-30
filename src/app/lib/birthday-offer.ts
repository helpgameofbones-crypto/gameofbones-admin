import { SupabaseClient } from '@supabase/supabase-js'
import { marketingUnsubscribeUrl } from '@/app/lib/marketing-unsubscribe'

export const BIRTHDAY_DISCOUNT_PERCENT = 15
export const BIRTHDAY_MINIMUM_ORDER = 499
export const BIRTHDAY_VALIDITY_HOURS = 48

type BirthdayEntry = { id: string; dog_name?: string | null; customer_name?: string | null }
export type BirthdayOfferOptions = {
  codePrefix?: string
  discountPercent?: number
  minimumOrder?: number
  validUntil?: Date
  validityHours?: number
}

const escapeHtml = (value: unknown) => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
const dateValue = (value: Date) => value.toISOString().slice(0, 10)

// This is deterministic for a pet and a calendar year so the email and the
// admin WhatsApp draft always carry the same one-time reward. It is not shown
// in public site content or campaign code lists.
export function birthdayCouponCode(birthdayId: string, year = new Date().getUTCFullYear(), prefix = 'BDAY') {
  return `${prefix}${String(birthdayId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}${year}`
}

export async function ensureBirthdayOffer(database: SupabaseClient, birthday: BirthdayEntry, now = new Date(), options: BirthdayOfferOptions = {}) {
  const discountPercent = options.discountPercent ?? BIRTHDAY_DISCOUNT_PERCENT
  const minimumOrder = options.minimumOrder ?? BIRTHDAY_MINIMUM_ORDER
  const validityHours = options.validityHours ?? BIRTHDAY_VALIDITY_HOURS
  const code = birthdayCouponCode(birthday.id, now.getUTCFullYear(), options.codePrefix || 'BDAY')
  const { data: existing, error: existingError } = await database
    .from('coupons')
    .select('id,code,type,value,min_order,max_uses,uses_count,valid_from,valid_until,is_active')
    .eq('code', code)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing

  const validUntil = options.validUntil || new Date(now.getTime() + validityHours * 60 * 60 * 1000)
  const { data, error } = await database.from('coupons').insert({
    code,
    type: 'percent',
    value: discountPercent,
    min_order: minimumOrder,
    max_uses: 1,
    uses_count: 0,
    valid_from: dateValue(now),
    valid_until: dateValue(validUntil),
    is_active: true,
  }).select('id,code,type,value,min_order,max_uses,uses_count,valid_from,valid_until,is_active').single()
  if (error) throw error
  return data
}

export function birthdayOfferEmail(birthday: BirthdayEntry & { customer_email?: string | null }, code: string, options: BirthdayOfferOptions = {}) {
  const dogName = escapeHtml(birthday.dog_name || 'your dog')
  const parentName = escapeHtml(birthday.customer_name || 'there')
  const discountPercent = options.discountPercent ?? BIRTHDAY_DISCOUNT_PERCENT
  const minimumOrder = options.minimumOrder ?? BIRTHDAY_MINIMUM_ORDER
  const validityHours = options.validityHours ?? BIRTHDAY_VALIDITY_HOURS
  const expiry = options.validUntil
    ? options.validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : `the next ${validityHours} hours`
  const minimumCopy = minimumOrder > 0 ? `Orders of ₹${minimumOrder}+` : 'No minimum order value'
  const unsubscribe = birthday.customer_email ? marketingUnsubscribeUrl(birthday.customer_email) : ''
  return {
    subject: `Happy Birthday, ${birthday.dog_name || 'pup'} — a treat from Game of Bones`,
    text: `Hi ${birthday.customer_name || 'there'},\n\nHappy Birthday to ${birthday.dog_name || 'your dog'}! Your private birthday reward is ${code}: ${discountPercent}% off with no minimum order value. Use it once at checkout by ${expiry}.\n\nShop: https://gameofbones.in/products${unsubscribe ? `\n\nUnsubscribe from marketing emails: ${unsubscribe}` : ''}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fbf7ef;color:#173d2b"><div style="background:#173d2b;padding:28px;text-align:center"><img src="https://gameofbones.in/assets/gob-logo.png" width="96" height="auto" alt="Game of Bones" style="display:block;margin:0 auto 12px"><div style="color:#f3c56c;font-size:14px;letter-spacing:2px;font-weight:700">A BIRTHDAY TREAT</div></div><div style="padding:36px 32px;text-align:center"><h1 style="font-size:30px;line-height:1.15;margin:0 0 14px;color:#173d2b">Happy Birthday, ${dogName}! 🐾</h1><p style="font-size:16px;line-height:1.5;margin:0 0 20px">Hi ${parentName}, here is a private birthday reward for your good dog.</p><div style="background:#fff;border:2px dashed #bd812a;padding:22px;margin:24px auto;max-width:330px"><div style="font-size:28px;font-weight:800;color:#173d2b">${discountPercent}% OFF</div><p style="margin:8px 0;color:#526b5c;font-size:14px">${minimumCopy} · one use · valid until ${escapeHtml(expiry)}</p><div style="font-family:monospace;font-size:20px;letter-spacing:1px;font-weight:800;background:#173d2b;color:#fff;padding:12px">${escapeHtml(code)}</div></div><a href="https://gameofbones.in/checkout" style="display:inline-block;background:#bd812a;color:#173d2b;padding:14px 24px;text-decoration:none;font-weight:800">Choose a birthday treat</a><p style="font-size:12px;line-height:1.5;color:#526b5c;margin:28px 0 0">This is a private, one-time birthday reward for ${dogName}. It is not a public promotion.</p>${unsubscribe ? `<p style="font-size:12px;line-height:1.5;color:#526b5c;margin:12px 0 0"><a href="${unsubscribe}" style="color:#173d2b;text-decoration:underline">Unsubscribe from marketing emails</a></p>` : ''}</div></div>`,
  }
}
