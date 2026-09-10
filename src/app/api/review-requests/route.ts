import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { customerEmail } from '@/app/lib/lifecycle-emails'
import { revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
  for (const order of deliveredOrders || []) {
    const email = customerEmail(order.customer_email)
    if (!email) continue
    const items = (order.items || []).slice(0, 2).map((item: any) => item.product_name || item.name).filter(Boolean).join(' and ') || 'your treats'
    const firstName = escapeHtml(revealLegacyPii(order.customer_name).split(' ')[0] || 'there')
    await resend.emails.send({
      to: email,
      subject: `How did ${items} go down?`,
      html: `<!doctype html><html><body style="margin:0;background:#f7f0e4;font-family:Arial,sans-serif;color:#082f26"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#082f26;padding:28px;text-align:center"><strong style="color:#d28b21;letter-spacing:2px">GAME OF BONES</strong></div><div style="background:#fffdf8;padding:32px;text-align:center"><h1 style="margin-top:0">How did your pup like the treats?</h1><p>Hi ${firstName}, your order <strong>${escapeHtml(order.ref)}</strong> was delivered a few days ago. We'd love a quick, honest review.</p><a href="https://gameofbones.in/products" style="display:inline-block;margin:16px 0;background:#c88722;color:#fff;padding:14px 24px;text-decoration:none;font-weight:700">LEAVE A REVIEW →</a><div style="margin-top:12px;padding:18px;background:#f9e7a5;text-align:left"><strong>50 Game of Bones points after approval</strong><br><span style="font-size:13px">Once your review is moderated and approved, we will add 50 points to your customer account. Points are not awarded for unapproved reviews.</span></div></div></div></body></html>`,
    })
    await supabase.from('orders').update({ review_request_sent_at: new Date().toISOString() }).eq('id', order.id)
    sent++
  }

  return NextResponse.json({ ok: true, orders_checked: deliveredOrders?.length || 0, emails_sent: sent })
}
