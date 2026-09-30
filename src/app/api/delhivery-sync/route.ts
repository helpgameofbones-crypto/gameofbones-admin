import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendDeliveredEmail, sendOutForDeliveryEmail } from '@/app/lib/lifecycle-emails'

const SUPABASE_FN_URL = 'https://syuostlqzzinigqwjzap.supabase.co/functions/v1'

type NotificationOrder = {
  id: string
  status: string
  ref?: unknown
  customer_email?: unknown
  customer_name?: unknown
  pii_email_ciphertext?: unknown
  pii_name_ciphertext?: unknown
  delhivery_awb?: unknown
  out_for_delivery_email_eligible_at?: string | null
  delivered_email_eligible_at?: string | null
  out_for_delivery_email_sent_at?: string | null
  delivered_email_sent_at?: string | null
}

async function sendStatusNotifications() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRole) throw new Error('Server misconfiguration: Supabase service role is not configured.')
  const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole)
  const fields = 'id,status,ref,customer_email,customer_name,pii_email_ciphertext,pii_name_ciphertext,delhivery_awb,out_for_delivery_email_eligible_at,delivered_email_eligible_at,out_for_delivery_email_sent_at,delivered_email_sent_at'
  const { data: orders, error } = await database
    .from('orders')
    .select(fields)
    .or('and(status.eq.out_for_delivery,out_for_delivery_email_eligible_at.not.is.null,out_for_delivery_email_sent_at.is.null),and(status.eq.delivered,delivered_email_eligible_at.not.is.null,delivered_email_sent_at.is.null)')
    .limit(100)
  if (error) throw error

  let outForDeliverySent = 0
  let deliveredSent = 0
  const errors: Array<{ ref: unknown; status: string; error: string }> = []
  for (const order of (orders || []) as NotificationOrder[]) {
    try {
      if (order.status === 'out_for_delivery' && order.out_for_delivery_email_eligible_at && !order.out_for_delivery_email_sent_at) {
        if (await sendOutForDeliveryEmail(order)) {
          const { error: updateError } = await database.from('orders').update({ out_for_delivery_email_sent_at: new Date().toISOString() }).eq('id', order.id).is('out_for_delivery_email_sent_at', null)
          if (updateError) throw updateError
          outForDeliverySent++
        }
      }
      if (order.status === 'delivered' && order.delivered_email_eligible_at && !order.delivered_email_sent_at) {
        if (await sendDeliveredEmail(order)) {
          const { error: updateError } = await database.from('orders').update({ delivered_email_sent_at: new Date().toISOString() }).eq('id', order.id).is('delivered_email_sent_at', null)
          if (updateError) throw updateError
          deliveredSent++
        }
      }
    } catch (notificationError) {
      errors.push({ ref: order.ref, status: order.status, error: notificationError instanceof Error ? notificationError.message : 'Could not send notification.' })
    }
  }
  return { out_for_delivery_sent: outForDeliverySent, delivered_sent: deliveredSent, notification_errors: errors }
}

// Cron job (see vercel.json) — automatically syncs order status from Delhivery
// tracking (placed/confirmed/dispatched/shipped/delivered/etc.) into Supabase.
// This calls the same sync-delhivery-status Supabase Edge Function that the
// "Sync All Statuses" button on /delhivery-sync already triggers manually —
// before this route existed, that button was the ONLY way statuses ever
// updated, so orders sat on stale statuses until someone opened the admin
// panel and clicked it by hand. Runs every 3 hours; safe to call repeatedly,
// the underlying function just re-checks each non-final order against
// Delhivery's tracking API and updates rows whose status actually changed.
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  try {
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceRole) {
          return NextResponse.json({ error: 'Server misconfiguration: Supabase service role is not configured.' }, { status: 500 })
        }

        const res = await fetch(`${SUPABASE_FN_URL}/sync-delhivery-status`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRole}`,
            apikey: serviceRole,
          },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({ error: `Sync service returned an invalid response (HTTP ${res.status}).` }))
        if (!res.ok) {
          console.error('[delhivery-sync] Edge Function request failed', { status: res.status, data })
          return NextResponse.json({ ok: false, ...data }, { status: 502 })
        }
        const notifications = await sendStatusNotifications()
        return NextResponse.json({ ok: true, ...data, notifications })
  } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
