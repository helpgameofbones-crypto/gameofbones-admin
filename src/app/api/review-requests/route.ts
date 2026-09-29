import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { customerEmail } from '@/app/lib/lifecycle-emails'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { buildReviewRequestEmail } from '@/app/lib/review-email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Item = { product_name?: unknown; name?: unknown }
type Order = { id: string; ref: string; customer_name?: unknown; customer_email?: unknown; pii_name_ciphertext?: unknown; pii_email_ciphertext?: unknown; items?: unknown }
function names(items: unknown) { return Array.isArray(items) ? [...new Set((items as Item[]).map(item => String(item.product_name || item.name || '').trim()).filter(Boolean))] : [] }

// The scheduled delivery follow-up stays deliberately narrow. It cannot email
// a free order and uses the same verified-account review destination as the
// one-time historical campaign preview.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase.from('orders').select('id,ref,customer_name,customer_email,pii_name_ciphertext,pii_email_ciphertext,items').eq('status', 'delivered').or('grand_total.gt.0,total_amount.gt.0').is('review_request_sent_at', null).gte('updated_at', fourDaysAgo.toISOString()).lte('updated_at', threeDaysAgo.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let sent = 0
  for (const order of (data || []) as Order[]) {
    const email = customerEmail(order.pii_email_ciphertext || order.customer_email); if (!email) continue
    const firstName = revealLegacyPii(order.pii_name_ciphertext || order.customer_name).split(' ')[0] || 'there'
    const message = buildReviewRequestEmail({ firstName, products: names(order.items) })
    const result = await resend.emails.send({ to: email, subject: message.subject, html: message.html })
    if (!result.error) { await supabase.from('orders').update({ review_request_sent_at: new Date().toISOString() }).eq('id', order.id); sent++ }
  }
  return NextResponse.json({ ok: true, orders_checked: data?.length || 0, emails_sent: sent })
}
