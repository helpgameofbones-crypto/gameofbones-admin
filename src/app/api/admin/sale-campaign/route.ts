import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { revealLegacyPii } from '@/app/lib/pii-crypto'
import { marketingUnsubscribeUrl } from '@/app/lib/marketing-unsubscribe'

const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Contact = { email: string; name: string; purchased: boolean; optedIn: boolean }
const readEmail = (row: Record<string, unknown>) => revealLegacyPii(row.pii_email_ciphertext || row.email || row.customer_email).trim().toLowerCase()
const readName = (row: Record<string, unknown>) => revealLegacyPii(row.pii_name_ciphertext || row.name || row.customer_name).trim()
const isTestEmail = (email: string) => /@(example\.com|test\.com)$/i.test(email) || /^(admin|test|payment-test)@/i.test(email)
const isHistoricalSpinLead = (source: unknown) => ['spin_to_win', 'spin_wheel'].includes(String(source || '').trim().toLowerCase())

function emailHtml(contact: Contact) {
  const code = contact.purchased ? 'GOBFAMILY10' : 'WELCOME15'
  const saving = contact.purchased ? '10%' : '15%'
  const name = contact.name.split(' ')[0] || 'there'
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f6f2;color:#173c2d"><div style="background:#1a1008;padding:24px;text-align:center"><h1 style="color:#d5a234;margin:0">Game of Bones</h1></div><div style="padding:32px"><h2 style="margin:0 0 14px">A little something for your pup 🐾</h2><p>Hi ${name}, our sale is on right now.</p><div style="background:#fff;border:2px dashed #c8973a;border-radius:12px;padding:18px;text-align:center;margin:22px 0"><div style="font-size:13px;color:#665f53">USE CODE</div><strong style="font-size:27px;letter-spacing:2px;color:#b57618">${code}</strong><p style="margin:10px 0 0">${saving} off · no minimum order value</p></div><p>Pay online and you’ll also get an extra ₹30 off at checkout.</p><p style="margin:24px 0"><a href="https://gameofbones.in/products" style="background:#c8973a;color:#1a1008;padding:13px 22px;text-decoration:none;font-weight:700;border-radius:7px">Shop the sale</a></p></div><div style="background:#173c2d;padding:18px 24px;text-align:center"><a href="${marketingUnsubscribeUrl(contact.email)}" style="color:#fff;font-size:12px">Unsubscribe from marketing emails</a></div></div>`
}

async function audience(includeAllOrderCustomers = false): Promise<Contact[]> {
  const [orders, captures, carts] = await Promise.all([
    database.from('orders').select('pii_email_hash,pii_email_ciphertext,pii_name_ciphertext,customer_email,customer_name,marketing_consent,status,is_refunded').limit(5000),
    database.from('email_captures').select('pii_email_hash,pii_email_ciphertext,pii_name_ciphertext,email,name,marketing_consent,source').limit(5000),
    database.from('abandoned_carts').select('pii_email_hash,pii_email_ciphertext,pii_name_ciphertext,customer_email,customer_name').limit(5000),
  ])
  if (orders.error || captures.error || carts.error) throw new Error('Unable to load campaign contacts.')
  const contacts = new Map<string, Contact>()
  const add = (row: Record<string, unknown>, purchased = false, forceOptIn = false) => {
    const email = readEmail(row)
    if (!emailPattern.test(email) || isTestEmail(email)) return
    const existing = contacts.get(email) || { email, name: '', purchased: false, optedIn: false }
    existing.name ||= readName(row)
    existing.purchased ||= purchased
    existing.optedIn ||= forceOptIn || row.marketing_consent === true || isHistoricalSpinLead(row.source)
    contacts.set(email, existing)
  }
  for (const order of orders.data || []) {
    const purchased = String(order.status || '').toLowerCase() !== 'cancelled' && order.is_refunded !== true
    add(order as Record<string, unknown>, purchased, includeAllOrderCustomers && purchased)
  }
  for (const capture of captures.data || []) add(capture as Record<string, unknown>)
  for (const cart of carts.data || []) add(cart as Record<string, unknown>)
  return [...contacts.values()].filter(contact => contact.optedIn)
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError
  const body = await req.json().catch(() => ({}))
  const send = body.send === true
  const prospectsOnly = body.audience === 'prospects'
  const buyersOnly = body.audience === 'buyers'
  const contacts = await audience(body.includeAllOrderCustomers === true)
  const buyers = contacts.filter(contact => contact.purchased)
  const prospects = contacts.filter(contact => !contact.purchased)
  if (!send) return NextResponse.json({ buyers: buyers.length, prospects: prospects.length, total: contacts.length })
  const recipients = prospectsOnly ? prospects : buyersOnly ? buyers : contacts
  let sent = 0
  const errors: string[] = []
  for (const contact of recipients) {
    try {
      await resend.emails.send({ from: 'onboarding@resend.dev', to: contact.email, subject: contact.purchased ? 'Your Game of Bones family sale is on 🐾' : 'Welcome treat: 15% off your first order 🐾', html: emailHtml(contact) })
      sent++
    } catch { errors.push(contact.email) }
  }
  await database.from('activity_log').insert({ action: prospectsOnly ? 'sale prospects campaign sent' : buyersOnly ? 'sale buyers campaign sent' : 'sale campaign sent', entity_type: 'campaign', entity_name: 'sale-oct-2026', details: `Sent ${sent}; recipients ${recipients.length}; buyers ${buyers.length}; prospects ${prospects.length}; failed ${errors.length}.` })
  return NextResponse.json({ sent, buyers: buyers.length, prospects: prospects.length, recipients: recipients.length, failed: errors.length })
}
