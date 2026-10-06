// Shipping addresses are stored in a few shapes: website checkout saves
// { line1, line2, city, state, pincode }, manual/older orders use
// { street, city, state, pincode }, and very old rows are plain text.
// Always show every part so admins see the complete address.
type AddressLike = Record<string, unknown>

function clean(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

export function addressStreet(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return ''
  const a = addr as AddressLike
  const first = clean(a.street) || clean(a.address) || clean(a.line1) || clean(a.address_line1)
  const second = clean(a.line2) || clean(a.address_line2)
  const landmark = clean(a.landmark)
  return [first, second && second !== first ? second : '', landmark ? `Landmark: ${landmark}` : ''].filter(Boolean).join(', ')
}

export function formatShippingAddress(addr: unknown): string {
  if (!addr) return ''
  let value: unknown = addr
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return value as string }
    if (typeof value === 'string') return value
  }
  if (!value || typeof value !== 'object') return ''
  const a = value as AddressLike
  const cityLine = [clean(a.city), clean(a.state)].filter(Boolean).join(', ')
  const pin = clean(a.pincode) || clean(a.pin) || clean(a.postal_code)
  return [addressStreet(a), cityLine, pin].filter(Boolean).join(', ')
}
