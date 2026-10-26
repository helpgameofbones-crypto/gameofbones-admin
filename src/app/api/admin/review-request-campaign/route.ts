import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { resend } from '@/app/lib/emailClient'
import { customerEmail } from '@/app/lib/lifecycle-emails'
import { decryptPii, normalizePhoneForHash, revealLegacyPii } from '@/app/lib/pii-crypto'
import { createReviewLink } from '@/app/lib/review-link'
import { buildReviewRequestEmail } from '@/app/lib/review-email'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
type Item = { product_name?: unknown; name?: unknown }
type Order = { id: string; ref: string; customer_id?: string | null; customer_phone?: string | null; pii_phone_ciphertext?: unknown; customer_name?: unknown; customer_email?: unknown; pii_name_ciphertext?: unknown; pii_email_ciphertext?: unknown; items?: unknown }
type Product = { id: string; name: string }
function normalize(value: string) { return value.trim().toLocaleLowerCase('en-IN').replace(/\s+/g, ' ') }
function names(items: unknown) { return Array.isArray(items) ? [...new Set((items as Item[]).map(item => String(item.product_name || item.name || '').trim()).filter(Boolean))] : [] }
type Recipient = { email: string; firstName: string; phone: string; products: Array<{ id: string; name: string }>; orderIds: string[] }

async function eligibleRecipients(includePrevious = false) {
  const [ordersResult, productsResult] = await Promise.all([
    (() => { const q = db.from('orders').select('id,ref,customer_id,customer_phone,pii_phone_ciphertext,customer_name,customer_email,pii_name_ciphertext,pii_email_ciphertext,items').eq('status', 'delivered').or('grand_total.gt.0,total_amount.gt.0'); return (includePrevious ? q : q.is('review_request_sent_at', null)).limit(1000) })(),
    db.from('products').select('id,name').limit(500),
  ])
  if (ordersResult.error) throw ordersResult.error
  if (productsResult.error) throw productsResult.error
  const byName = new Map(((productsResult.data || []) as Product[]).map(product => [normalize(product.name), product]))
  const orders = (ordersResult.data || []) as Order[]
  const grouped = new Map<string, Recipient>()
  for (const order of orders) {
    const email = customerEmail(order.pii_email_ciphertext || order.customer_email); if (!email) continue
    const products = names(order.items).map(name => byName.get(normalize(name))).filter((product): product is Product => Boolean(product)); if (!products.length) continue
    const key = `${order.customer_id || order.customer_phone || email}:${email}`
    const current = grouped.get(key) || { email, firstName: revealLegacyPii(order.pii_name_ciphertext || order.customer_name).split(' ')[0] || 'there', phone: normalizePhoneForHash(decryptPii(String(order.pii_phone_ciphertext || '')) || revealLegacyPii(order.customer_phone)), products: [], orderIds: [] }
    current.products.push(...products); current.orderIds.push(order.id); grouped.set(key, current)
  }
  const pending = [...grouped.values()].map(row => ({ ...row, products: [...new Map(row.products.map(product => [product.id, product])).values()] }))
  const phones = pending.map(row => row.phone).filter(Boolean)
  const reviewedResult = phones.length ? await db.from('product_reviews').select('customer_phone,product_id').in('customer_phone', phones) : { data: [], error: null }
  if (reviewedResult.error) throw reviewedResult.error
  const reviewed = new Map<string, Set<string>>()
  for (const row of reviewedResult.data || []) { const current = reviewed.get(row.customer_phone) || new Set<string>(); current.add(row.product_id); reviewed.set(row.customer_phone, current) }
  const recipients = pending.map(row => ({ ...row, products: row.products.filter(product => !reviewed.get(row.phone)?.has(product.id)) })).filter(row => row.products.length)
  return { recipients, eligibleOrderCount: orders.length }
}

export const maxDuration = 60
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  try {
    const includePrevious = request.nextUrl.searchParams.get('include_previous') === '1'
    const { recipients, eligibleOrderCount } = await eligibleRecipients(includePrevious)
    const preview = buildReviewRequestEmail({ firstName: 'Anjan', products: ['Chicken Wings', 'Goat Trotter'] })
    return NextResponse.json({ eligible_orders: eligibleOrderCount, recipients: recipients.length, preview })
  } catch (error) { console.error('Review campaign preview failed', error); return NextResponse.json({ error: 'Unable to prepare the review campaign preview.' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => ({})) as { confirm?: unknown; scheduled_at?: unknown; include_previous?: unknown }
  if (body.confirm !== true) return NextResponse.json({ error: 'Explicit confirmation is required before emails are sent.' }, { status: 400 })
  let scheduledAt: string | undefined
  if (body.scheduled_at != null) {
    const when = new Date(String(body.scheduled_at))
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000 || when.getTime() > Date.now() + 29 * 86_400_000) return NextResponse.json({ error: 'Pick a send time between 1 minute and 29 days from now.' }, { status: 400 })
    scheduledAt = when.toISOString()
  }
  try {
    const { recipients } = await eligibleRecipients(body.include_previous === true); let sent = 0, failed = 0
    for (const recipient of recipients) {
      const message = buildReviewRequestEmail({ firstName: recipient.firstName, products: recipient.products.map(product => product.name), reviewUrl: await createReviewLink(recipient.phone) })
      const result = await resend.emails.send({ to: recipient.email, subject: message.subject, html: message.html, ...(scheduledAt ? { scheduledAt } : {}) }) as { error?: unknown }
      if (result?.error) { failed++; console.error('Review invite failed', result.error); await sleep(550); continue }
      await db.from('orders').update({ review_request_sent_at: scheduledAt || new Date().toISOString() }).in('id', recipient.orderIds)
      sent++
      await sleep(550) // stay under Resend's 2 requests/second limit
    }
    return NextResponse.json({ ok: true, recipients: recipients.length, emails_sent: sent, failed, scheduled_at: scheduledAt || null })
  } catch (error) { console.error('Review campaign send failed', error); return NextResponse.json({ error: 'Unable to send the review campaign.' }, { status: 500 }) }
}
