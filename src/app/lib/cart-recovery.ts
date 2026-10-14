import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Shared helpers for the cart-recovery and payment-dropout emails.

export type RecoveryItem = {
  name?: unknown
  product_name?: unknown
  sizeLabel?: unknown
  size?: unknown
  pack_label?: unknown
  qty?: unknown
  quantity?: unknown
  price?: unknown
  pack_price?: unknown
}

type ProductImageRow = { name: string; image_url?: unknown; images?: unknown }

export const SITE = 'https://gameofbones.in'
export const WELCOME_CODE = 'WELCOME15'

export function text(value: unknown): string {
  return String(value ?? '').trim()
}

export function escapeHtml(value: unknown): string {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const itemName = (item: RecoveryItem) => text(item.name ?? item.product_name) || 'Treat'

function catalogueImage(row: ProductImageRow): string {
  const candidates = [...(Array.isArray(row.images) ? row.images : []), row.image_url]
  return candidates.map(value => text(value)).find(value => /^https:\/\//i.test(value)) || ''
}

async function productImagesFor(db: SupabaseClient, items: RecoveryItem[]): Promise<Map<string, string>> {
  const names = [...new Set(items.map(itemName).filter(Boolean))].slice(0, 25)
  if (!names.length) return new Map()
  const { data, error } = await db.from('products').select('name,image_url,images').in('name', names)
  if (error || !data) return new Map()
  return new Map((data as ProductImageRow[]).map(p => [text(p.name), catalogueImage(p)] as const).filter(([, image]) => Boolean(image)))
}

/** Email rows for the treats in a bag. Images come from the live catalogue, never the payload. */
export async function itemsHtml(db: SupabaseClient, items: RecoveryItem[]): Promise<string> {
  const images = await productImagesFor(db, items)
  return items.map(item => {
    const name = itemName(item)
    const pack = text(item.sizeLabel ?? item.size ?? item.pack_label)
    const quantity = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1)
    const price = Math.max(0, Number(item.price ?? item.pack_price) || 0)
    const image = images.get(name) || ''
    const imageCell = image
      ? `<td width="68" valign="middle" style="width:68px;padding:10px 12px 10px 0"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #eee6d8" /></td>`
      : ''
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f0ebe3"><tr>${imageCell}<td valign="middle" style="padding:10px 0;font-size:13px;line-height:1.45;color:#1a1008"><strong>${escapeHtml(name)}</strong>${pack ? ` · ${escapeHtml(pack)}` : ''} × ${quantity}</td><td valign="middle" align="right" style="padding:10px 0;font-size:13px;font-weight:600;color:#1a1008;white-space:nowrap">${price ? `₹${(price * quantity).toLocaleString('en-IN')}` : ''}</td></tr></table>`
  }).join('')
}

/**
 * True when neither the phone nor the email hash has a real order yet (and
 * neither has used a first-order code). Unknown → false, so we never promise
 * WELCOME15 to someone the checkout would refuse.
 */
export async function isFirstOrderCustomer(db: SupabaseClient, phoneHash: string | null, emailHash: string | null): Promise<boolean> {
  const filters = [phoneHash && `pii_phone_hash.eq.${phoneHash}`, emailHash && `pii_email_hash.eq.${emailHash}`].filter(Boolean) as string[]
  if (!filters.length) return false
  const { data, error } = await db.from('orders').select('status,coupon_code').or(filters.join(',')).limit(20)
  if (error) return false
  return !(data || []).some((order: { status?: string | null; coupon_code?: string | null }) => {
    const status = String(order.status || '')
    if (['WELCOME15', 'CART50'].includes(String(order.coupon_code || '').toUpperCase())) return true
    return status !== 'pending_payment' && !/^cancel/i.test(status)
  })
}

/** A bag restore link (`/cart?restore=TOKEN`). Creates the token on first use. */
export async function restoreLink(db: SupabaseClient, cart: { id: string; restore_token?: string | null } | null, code?: string | null): Promise<string> {
  const params = new URLSearchParams()
  if (cart) {
    let token = cart.restore_token || ''
    if (!token) {
      token = randomBytes(12).toString('base64url')
      await db.from('abandoned_carts').update({ restore_token: token }).eq('id', cart.id)
    }
    params.set('restore', token)
  }
  if (code) params.set('code', code)
  const query = params.toString()
  return `${SITE}/cart${query ? `?${query}` : ''}`
}

/** The offer box shown under the bag in recovery emails. */
export function offerBox(code: string, label: string, note = 'if you complete your order in the next 24 hours'): string {
  return `<div style="margin-top:13px;background:#fff4cb;border:1px solid #dfb75e;border-radius:9px;padding:12px 15px;font-size:13px;line-height:1.45">Use code <strong>${escapeHtml(code)}</strong> for ${escapeHtml(label)} ${escapeHtml(note)}. It is already added when you tap the button below.</div>`
}
