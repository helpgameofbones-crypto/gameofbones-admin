import 'server-only'

import { decryptPii, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'

type OrderRecord = Record<string, unknown>

function parseAddress(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

function revealField(ciphertext: unknown, legacyValue: unknown): string {
  if (typeof ciphertext === 'string' && ciphertext) return decryptPii(ciphertext)
  return revealLegacyPii(legacyValue)
}

function revealAddress(ciphertext: unknown, legacyValue: unknown): unknown {
  if (typeof ciphertext === 'string' && ciphertext) return parseAddress(decryptPii(ciphertext))
  return parseAddress(revealLegacyPiiValue(legacyValue))
}

// This boundary is intentionally server-only. It is the sole place admin API
// responses turn stored PII into readable values for an authenticated admin.
export function revealOrderForAdmin(order: OrderRecord): OrderRecord {
  return {
    ...order,
    customer_name: revealField(order.pii_name_ciphertext, order.customer_name),
    customer_phone: revealField(order.pii_phone_ciphertext, order.customer_phone),
    customer_email: revealField(order.pii_email_ciphertext, order.customer_email),
    shipping_address: revealAddress(order.pii_address_ciphertext, order.shipping_address),
    // Never send the encrypted copies to the browser. The readable fields above
    // are only returned after requireAdmin() has authenticated the request.
    pii_name_ciphertext: undefined,
    pii_phone_ciphertext: undefined,
    pii_email_ciphertext: undefined,
    pii_address_ciphertext: undefined,
    pii_phone_hash: undefined,
    pii_email_hash: undefined,
  }
}
