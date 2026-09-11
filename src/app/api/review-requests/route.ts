import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { customerEmail } from '@/app/lib/lifecycle-emails'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type ReviewOrderItem = { product_name?: unknown; name?: unknown }
type DeliveredOrder = { id: string; ref?: unknown; customer_name?: unknown; customer_email?: unknown; items?: unknown }

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  const { data: deliveredOrders, error } = await supabase
    .from('orders')
    .select('id,ref,customer_name,customer_email,items,updated_at')
    .eq('status', 'delivered')
    .is('review_request_sent_at', null)
    .gte('updated_at', fourDaysAgo.toISOString())
    .lte('updated_at', threeDaysAgo.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const order of (deliveredOrders || []) as DeliveredOrder[]) {
    const email = customerEmail(order.customer_email)
    if (!email) continue
    const orderItems = Array.isArray(order.items) ? order.items as ReviewOrderItem[] : []
    const items = orderItems.slice(0, 2).map((item) => item.product_name || item.name).filter((item): item is string => typeof item === 'string' && Boolean(item)).join(' and ') || 'your treats'
    const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
    await resend.emails.send({
      to: email,
      subject: `How did ${items} go down?`,
      html: lifecycleEmailTemplate({
        eyebrow: 'Your order has arrived',
        title: 'How did your pup like the treats?',
        introHtml: `Hi ${firstName}, your order <strong>${escapeHtml(order.ref)}</strong> was delivered a few days ago. We’d love a quick, honest review.`,
        ctaLabel: 'Leave a review',
        ctaUrl: 'https://gameofbones.in/products',
        detailHtml: emailCard(`<div style="color:#dc650b;font-size:14px;font-weight:800;letter-spacing:.4px">50 GAME OF BONES POINTS AFTER APPROVAL</div><div style="border-top:1px solid #dfc988;margin:14px 0 12px"></div><div style="font-size:13px;line-height:1.5">Once your review is moderated and approved, we will add 50 points to your customer account.</div>`, 'left'),
      }),
    })
    await supabase.from('orders').update({ review_request_sent_at: new Date().toISOString() }).eq('id', order.id)
    sent++
  }

  return NextResponse.json({ ok: true, orders_checked: deliveredOrders?.length || 0, emails_sent: sent })
}
