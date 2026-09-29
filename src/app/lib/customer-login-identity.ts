import { createClient } from '@supabase/supabase-js'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CustomerLoginIdentity = {
  customerId: string | null
  email: string
  phone: string
  name: string
}

function reveal(value: unknown) {
  try { return revealLegacyPii(value) } catch { return '' }
}

function phone(value: unknown) {
  return reveal(value).replace(/\D/g, '').slice(-10)
}

function fromRow(row: { id?: string | null; customer_id?: string | null; email?: unknown; customer_email?: unknown; phone?: unknown; customer_phone?: unknown; name?: unknown; customer_name?: unknown }, email: string): CustomerLoginIdentity | null {
  const rowEmail = reveal(row.email ?? row.customer_email).toLowerCase()
  const rowPhone = phone(row.phone ?? row.customer_phone)
  if (rowEmail !== email || !/^\d{10}$/.test(rowPhone)) return null
  return {
    customerId: row.id || row.customer_id || null,
    email,
    phone: rowPhone,
    name: reveal(row.name ?? row.customer_name) || 'Game of Bones customer',
  }
}

// Historic checkouts predate the customers table. Authorising a login from a
// matching past order lets those legitimate customers access their account
// without revealing whether an address is known to an unauthenticated caller.
export async function findCustomerLoginIdentity(email: string) {
  const { data: customers, error: customerError } = await supabase
    .from('customers').select('id,name,email,phone').limit(1000)
  if (customerError) return { identity: null, error: customerError }

  const profileMatches = (customers || []).map(row => fromRow(row, email)).filter(Boolean) as CustomerLoginIdentity[]
  if (profileMatches.length === 1) return { identity: profileMatches[0], error: null }
  if (profileMatches.length > 1) return { identity: null, error: null }

  const { data: orders, error: orderError } = await supabase
    .from('orders').select('customer_id,customer_name,customer_email,customer_phone,created_at').limit(1000)
  if (orderError) return { identity: null, error: orderError }

  const orderMatches = (orders || []).map(row => fromRow(row, email)).filter(Boolean) as CustomerLoginIdentity[]
  const phones = [...new Set(orderMatches.map(match => match.phone))]
  if (phones.length !== 1) return { identity: null, error: null }
  return { identity: orderMatches.find(match => match.customerId) || orderMatches[0], error: null }
}
