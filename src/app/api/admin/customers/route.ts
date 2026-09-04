import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

type Customer = { phone: string; name: string; email: string; totalOrders: number; totalValue: number; lastOrderDate: string; orders: Record<string, unknown>[]; couponsUsed: string[]; avgOrderValue: number }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json({ error: 'Unable to load customers.' }, { status: 500 })

  try {
    const customers = new Map<string, Customer>()
    for (const rawOrder of data || []) {
      const order = revealOrderForAdmin(rawOrder)
      const phone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10)
      if (!phone) continue
      const existing = customers.get(phone) || { phone, name: '', email: '', totalOrders: 0, totalValue: 0, lastOrderDate: String(order.created_at || ''), orders: [], couponsUsed: [], avgOrderValue: 0 }
      existing.totalOrders += 1
      existing.totalValue += Number(order.grand_total || order.total_amount || 0)
      existing.name ||= String(order.customer_name || '')
      existing.email ||= String(order.customer_email || '')
      const coupon = typeof order.coupon_code === 'string' ? order.coupon_code : ''
      if (coupon && !existing.couponsUsed.includes(coupon)) existing.couponsUsed.push(coupon)
      existing.orders.push(order)
      customers.set(phone, existing)
    }
    const result = Array.from(customers.values()).map(customer => ({ ...customer, avgOrderValue: customer.totalOrders ? Math.round(customer.totalValue / customer.totalOrders) : 0 }))
    return NextResponse.json({ customers: result })
  } catch (error) {
    console.error('Admin customer decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
