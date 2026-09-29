import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CustomerLoginIdentity = { customerId: string; phone: string }

// Customer email and phone values in historic profiles were encrypted using a
// database-owned scheme. Resolve them through the internal, service-role-only
// function so logins behave exactly like existing account-profile lookups.
export async function findCustomerLoginIdentity(email: string) {
  const { data, error } = await supabase.rpc('find_customer_login_identity', { p_email: email })
  if (error) return { identity: null, error }
  const matches = (data || []).filter((row: { customer_id: string | null; customer_phone: string | null }) => /^\d{10}$/.test(String(row.customer_phone || '')))
  if (matches.length !== 1) return { identity: null, error: null }
  return { identity: { customerId: String(matches[0].customer_id), phone: String(matches[0].customer_phone) }, error: null }
}
