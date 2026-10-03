import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { requireAdmin } from '@/app/lib/requireAdmin'

type Customer = { phone: string; name: string; email: string; totalOrders: number; totalValue: number; lastOrderDate: string; orders: Record<string, unknown>[]; couponsUsed: string[]; avgOrderValue: number; needsPhoneReview: boolean }
type CustomerProfile = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  pii_name_ciphertext: string | null
  pii_email_ciphertext: string | null
  pii_phone_ciphertext: string | null
}

const phoneDigits = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-10)
const isFullIndianMobile = (value: string) => /^\d{10}$/.test(value)
const normalizedEmail = (value: unknown) => String(value || '').trim().toLowerCase()
const normalizedName = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()

function uniqueProfile(profiles: CustomerProfile[]): CustomerProfile | null {
  return profiles.length === 1 && isFullIndianMobile(phoneDigits(profiles[0].phone)) ? profiles[0] : null
}

function revealProfile(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    name: revealLegacyPii(profile.pii_name_ciphertext || profile.name),
    email: revealLegacyPii(profile.pii_email_ciphertext || profile.email),
    phone: revealLegacyPii(profile.pii_phone_ciphertext || profile.phone),
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [{ data, error }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('customers').select('id,name,email,phone,pii_name_ciphertext,pii_email_ciphertext,pii_phone_ciphertext').limit(1000),
  ])
  if (error) return NextResponse.json({ error: 'Unable to load customers.' }, { status: 500 })
  if (profilesError) return NextResponse.json({ error: 'Unable to reconcile customer contacts.' }, { status: 500 })

  try {
    const profilesByEmail = new Map<string, CustomerProfile[]>()
    const profilesByName = new Map<string, CustomerProfile[]>()
    const profilesById = new Map<string, CustomerProfile>()
    for (const rawProfile of profiles || []) {
      const profile = revealProfile(rawProfile as CustomerProfile)
      const email = normalizedEmail(profile.email)
      const name = normalizedName(profile.name)
      profilesById.set(profile.id, profile)
      if (email) profilesByEmail.set(email, [...(profilesByEmail.get(email) || []), profile])
      if (name) profilesByName.set(name, [...(profilesByName.get(name) || []), profile])
    }

    const customers = new Map<string, Customer>()
    for (const rawOrder of data || []) {
      const order = revealOrderForAdmin(rawOrder)
      const orderPhone = phoneDigits(order.customer_phone)
      const orderEmail = normalizedEmail(order.customer_email)
      const orderName = normalizedName(order.customer_name)
      const profile = !isFullIndianMobile(orderPhone)
        ? (() => {
            const linked = typeof rawOrder.customer_id === 'string' ? profilesById.get(rawOrder.customer_id) : null
            if (linked && isFullIndianMobile(phoneDigits(linked.phone))) return linked
            return uniqueProfile(profilesByEmail.get(orderEmail) || []) || uniqueProfile(profilesByName.get(orderName) || [])
          })()
        : null
      const phone = profile ? phoneDigits(profile.phone) : orderPhone
      const key = isFullIndianMobile(phone) ? phone : `needs-review:${String(order.id || order.ref || `${orderName}:${orderEmail}:${order.created_at || ''}`)}`
      const existing = customers.get(key) || {
        phone,
        name: String(profile?.name || order.customer_name || ''),
        email: String(profile?.email || order.customer_email || ''),
        totalOrders: 0,
        totalValue: 0,
        lastOrderDate: String(order.created_at || ''),
        orders: [],
        couponsUsed: [],
        avgOrderValue: 0,
        needsPhoneReview: !isFullIndianMobile(phone),
      }
      existing.totalOrders += 1
      existing.totalValue += Number(order.grand_total || order.total_amount || 0)
      existing.name ||= String(order.customer_name || '')
      existing.email ||= String(order.customer_email || '')
      const coupon = typeof order.coupon_code === 'string' ? order.coupon_code : ''
      if (coupon && !existing.couponsUsed.includes(coupon)) existing.couponsUsed.push(coupon)
      existing.orders.push(order)
      customers.set(key, existing)
    }
    const result = Array.from(customers.values()).map(customer => ({ ...customer, avgOrderValue: customer.totalOrders ? Math.round(customer.totalValue / customer.totalOrders) : 0 }))
    return NextResponse.json({ customers: result })
  } catch (error) {
    console.error('Admin customer decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
