import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

const INDIA_TIME_ZONE = 'Asia/Kolkata'
const DAYS_IN_TREND = 30

type DashboardOrder = {
  id: string
  ref: string | null
  created_at: string | null
  status: string | null
  payment_status: string | null
  payment_method: string | null
  grand_total: number | null
  total_amount: number | null
  delhivery_awb: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  shipping_address: unknown
  pii_name_ciphertext: string | null
  pii_phone_ciphertext: string | null
  pii_email_ciphertext: string | null
  pii_address_ciphertext: string | null
}

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function indiaDateKey(value: string | null | undefined) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function amount(order: DashboardOrder) {
  return Number(order.grand_total ?? order.total_amount ?? 0) || 0
}

function isRevenueOrder(order: DashboardOrder) {
  return order.status !== 'cancelled' && !['failed', 'pending_payment'].includes(String(order.payment_status || ''))
}

function isReadyToBook(order: DashboardOrder) {
  if (order.status !== 'confirmed' || order.delhivery_awb) return false
  if (order.payment_method === 'cod') return ['pending_cod', 'confirmed', ''].includes(String(order.payment_status || ''))
  return ['paid', 'captured'].includes(String(order.payment_status || ''))
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  // This endpoint intentionally returns calculated, non-sensitive operational
  // data. Detailed customer data remains in the protected order workspace.
  const { data, error } = await database()
    .from('orders')
    .select('id,ref,created_at,status,payment_status,payment_method,grand_total,total_amount,delhivery_awb,customer_id,customer_name,customer_phone,customer_email,shipping_address,pii_name_ciphertext,pii_phone_ciphertext,pii_email_ciphertext,pii_address_ciphertext')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    console.error('[admin-dashboard] unable to load orders', error)
    return NextResponse.json({ error: 'Unable to load dashboard data.' }, { status: 500 })
  }

  const orders = (data || []) as DashboardOrder[]
  const today = indiaDateKey(new Date().toISOString())
  const dayKeys = Array.from({ length: DAYS_IN_TREND }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (DAYS_IN_TREND - index - 1))
    return indiaDateKey(date.toISOString())
  })
  const sevenDayKeys = new Set(dayKeys.slice(-7))
  const todayOrders = orders.filter(order => indiaDateKey(order.created_at) === today && isRevenueOrder(order))
  const monthOrders = orders.filter(order => dayKeys.includes(indiaDateKey(order.created_at)) && isRevenueOrder(order))
  const weekOrders = monthOrders.filter(order => sevenDayKeys.has(indiaDateKey(order.created_at)))
  const readyToBook = orders.filter(isReadyToBook)
  const failedPayments = orders.filter(order => order.payment_status === 'failed')
  const missingAddresses = orders.filter(order => order.status === 'confirmed' && !order.shipping_address && !order.pii_address_ciphertext)
  const deliveryExceptions = orders.filter(order => ['rto', 'returned', 'delivery_failed'].includes(String(order.status || '')))
  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = order.status || 'unknown'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
  const trend = dayKeys.map(date => {
    const ordersForDay = orders.filter(order => indiaDateKey(order.created_at) === date && isRevenueOrder(order))
    return { date, orders: ordersForDay.length, revenue: ordersForDay.reduce((sum, order) => sum + amount(order), 0) }
  })

  const customerIds = [...new Set(orders.slice(0, 12).map(order => order.customer_id).filter((id): id is string => Boolean(id)))]
  const { data: customerRows } = customerIds.length
    ? await database().from('customers').select('id,name,phone').in('id', customerIds)
    : { data: [] as Array<{ id: string; name: string | null; phone: string | null }> }
  const customers = new Map((customerRows || []).map(customer => [customer.id, customer]))

  try {
    const recentOrders = orders.slice(0, 12).map(order => {
      const readable = revealOrderForAdmin(order)
      const customer = order.customer_id ? customers.get(order.customer_id) : undefined
      return {
        id: order.id,
        ref: order.ref || 'Unnumbered order',
        created_at: order.created_at,
        status: order.status || 'unknown',
        payment_status: order.payment_status || 'unknown',
        payment_method: order.payment_method || 'online',
        total: amount(order),
        customer_name: String(readable.customer_name || '').trim() || customer?.name || '',
        customer_phone: String(readable.customer_phone || '').trim() || customer?.phone || '',
        has_awb: Boolean(order.delhivery_awb),
      }
    })

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      metrics: {
        today_revenue: todayOrders.reduce((sum, order) => sum + amount(order), 0),
        today_orders: todayOrders.length,
        week_revenue: weekOrders.reduce((sum, order) => sum + amount(order), 0),
        week_orders: weekOrders.length,
        month_revenue: monthOrders.reduce((sum, order) => sum + amount(order), 0),
        month_orders: monthOrders.length,
        average_order_value: monthOrders.length ? Math.round(monthOrders.reduce((sum, order) => sum + amount(order), 0) / monthOrders.length) : 0,
        cod_rate: monthOrders.length ? Math.round((monthOrders.filter(order => order.payment_method === 'cod').length / monthOrders.length) * 100) : 0,
        total_orders: orders.length,
      },
      queues: {
        ready_to_book: readyToBook.length,
        failed_payments: failedPayments.length,
        missing_addresses: missingAddresses.length,
        delivery_exceptions: deliveryExceptions.length,
      },
      status_counts: statusCounts,
      trend,
      recent_orders: recentOrders,
    })
  } catch (decryptError) {
    console.error('[admin-dashboard] unable to decode recent orders', decryptError)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
