import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CustomerLoginIdentity = { customerId: string; phone: string }

// Customer email and phone values in historic profiles were encrypted using a
// database-owned scheme. Resolve them through the internal, service-role-only
// function so logins behave exactly like existing account-profile lookups.
export async function findCustomerLoginIdentity(email: string) {
  const { data, error } = await supabase.rpc('find_customer_login_identity', { p_email: email })
  if (error) return { identity: null, error }
  // The email OTP is the proof of identity. Retain a legacy numeric customer
  // key here so a historic order with a truncated phone is not locked out of
  // its own account; checkout itself still requires a real 10-digit mobile.
  const matches = (data || []).filter((row: { customer_id: string | null; customer_phone: string | null }) => /^\d{3,13}$/.test(String(row.customer_phone || '')))
  if (matches.length !== 1) return { identity: null, error: null }
  return { identity: { customerId: String(matches[0].customer_id), phone: String(matches[0].customer_phone) }, error: null }
}
