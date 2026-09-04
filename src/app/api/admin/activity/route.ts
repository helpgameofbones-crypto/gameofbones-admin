import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revealOrderForAdmin } from '@/app/lib/admin-order-pii'
import { requireAdmin } from '@/app/lib/requireAdmin'

type Activity = {
  id: string
  source: string
  action: string
  detail: string
  timestamp: string
}

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const [{ data: audit, error: auditError }, { data: orders, error: ordersError }, { data: blogs, error: blogsError }, { data: alerts, error: alertsError }] = await Promise.all([
    database().from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    database().from('orders').select('*').order('created_at', { ascending: false }).limit(30),
    database().from('blogs').select('id,title,created_at').order('created_at', { ascending: false }).limit(15),
    database().from('reorder_alerts').select('id,customer_name,alert_type,created_at').order('created_at', { ascending: false }).limit(15),
  ])

  if (auditError || ordersError || blogsError || alertsError) {
    return NextResponse.json({ error: 'Unable to load activity.' }, { status: 500 })
  }

  try {
    const items: Activity[] = []
    for (const entry of audit || []) {
      items.push({
        id: `audit-${entry.id}`,
        source: 'Orders',
        action: `Status changed: ${entry.old_data?.status || '?'} → ${entry.new_data?.status || '?'}`,
        detail: `Order #${entry.record_id || '—'}`,
        timestamp: entry.created_at,
      })
    }
    for (const rawOrder of orders || []) {
      const order = revealOrderForAdmin(rawOrder)
      items.push({
        id: `order-${order.id || order.ref}`,
        source: 'Orders',
        action: 'New order placed',
        detail: `#${order.ref || '—'} — ${order.customer_name || 'Customer'} — ₹${order.grand_total || order.total_amount || 0}`,
        timestamp: String(order.created_at || ''),
      })
    }
    for (const blog of blogs || []) {
      items.push({ id: `blog-${blog.id}`, source: 'Content', action: 'Blog article created or updated', detail: blog.title || 'Untitled article', timestamp: blog.created_at })
    }
    for (const alert of alerts || []) {
      items.push({
        id: `alert-${alert.id}`,
        source: 'Marketing',
        action: `${alert.alert_type === 'winback' ? 'Win-back' : 'Reorder'} alert generated`,
        detail: alert.customer_name || 'Customer',
        timestamp: alert.created_at,
      })
    }
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return NextResponse.json({ activities: items.slice(0, 100) })
  } catch (error) {
    console.error('Admin activity decryption failed', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
