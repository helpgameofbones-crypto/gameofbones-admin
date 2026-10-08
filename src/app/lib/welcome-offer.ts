import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

/**
 * WELCOME15 is for a customer's first order. No login needed: we check the
 * mobile number and email entered at checkout against past orders (matched by
 * their privacy-safe hashes). If either has a confirmed, non-cancelled order
 * already, or has used WELCOME15 before, the code is refused.
 */
export async function welcomeEligibleFor(db: SupabaseClient, phone: unknown, email: unknown, excludeRef?: string | null): Promise<boolean> {
  const phoneHash = piiHash(normalizePhoneForHash(String(phone || '')))
  const emailValue = String(email || '').trim()
  const emailHash = emailValue ? piiHash(normalizeEmailForHash(emailValue)) : null
  const filters = [phoneHash && `pii_phone_hash.eq.${phoneHash}`, emailHash && `pii_email_hash.eq.${emailHash}`].filter(Boolean) as string[]
  if (!phoneHash) return false // a valid mobile number is required to check
  let query = db.from('orders').select('ref,status,coupon_code').or(filters.join(',')).limit(20)
  if (excludeRef) query = query.neq('ref', excludeRef)
  const { data, error } = await query
  if (error) return false // cannot verify → do not grant the discount
  return !(data || []).some(order => {
    const status = String(order.status || '')
    if (String(order.coupon_code || '').toUpperCase() === 'WELCOME15') return true
    return status !== 'pending_payment' && !/^cancel/i.test(status)
  })
}
