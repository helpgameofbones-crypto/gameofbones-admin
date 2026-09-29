import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/app/lib/emailClient'
import { marketingUnsubscribeUrl } from '@/app/lib/marketing-unsubscribe'
import { piiHash } from '@/app/lib/pii-crypto'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/app/lib/requireAdmin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin(req)
    if (authError) return authError

    const { customers, campaign } = await req.json()
    if (!customers?.length) return NextResponse.json({ error: 'No customers', sent: 0 })
    const eligibleCustomers = await optedInCustomers(customers)
    const skipped = customers.length - eligibleCustomers.length
    if (!eligibleCustomers.length) {
      return NextResponse.json({ ok: true, sent: 0, skipped, errors: [] })
    }

    let sent = 0
    const errors: string[] = []

    for (const customer of eligibleCustomers) {
      try {
        const html = campaign.useHtml && campaign.htmlTemplate
          ? campaign.htmlTemplate.replace(/\{\{name\}\}/g, customer.name || 'Friend')
          : buildDefaultHtml(customer.name || 'Friend', campaign)
        const unsubscribeUrl = marketingUnsubscribeUrl(customer.email)

        await resend.emails.send({
          from:    'onboarding@resend.dev',
          to:      customer.email,
          subject: campaign.subject,
          html: `${html}${marketingFooter(unsubscribeUrl)}`,
          text: marketingText(customer.name || 'Friend', campaign, unsubscribeUrl),
        })
        sent++
        await new Promise(r => setTimeout(r, 100))
      } catch (e: any) {
        errors.push(customer.email + ': ' + e.message)
      }
    }

    await supabase.from('activity_log').insert({
      action:      'campaign sent',
      entity_type: 'campaign',
      entity_name: campaign.type,
      details:     `Sent to ${sent} opted-in customers; skipped ${skipped} without recorded consent. Subject: ${campaign.subject}`,
    })

    return NextResponse.json({ ok: true, sent, skipped, errors })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function optedInCustomers(customers: unknown[]) {
  const candidates = customers
    .filter((customer): customer is { email: string; name?: string } => Boolean(customer && typeof customer === 'object' && typeof (customer as { email?: unknown }).email === 'string'))
    .map(customer => ({ ...customer, email: customer.email.trim().toLowerCase() }))
    .filter(customer => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
  const hashes = Array.from(new Set(candidates.map(customer => piiHash(customer.email)).filter((hash): hash is string => Boolean(hash))))
  const optedIn = new Set<string>()

  // PostgREST URLs have practical size limits, so check recipients in small
  // batches rather than allowing an admin-selected audience to bypass consent.
  for (let index = 0; index < hashes.length; index += 100) {
    const batch = hashes.slice(index, index + 100)
    const [orders, captures] = await Promise.all([
      supabase.from('orders').select('pii_email_hash').in('pii_email_hash', batch).eq('marketing_consent', true),
      supabase.from('email_captures').select('pii_email_hash').in('pii_email_hash', batch).eq('marketing_consent', true),
    ])
    if (orders.error) throw orders.error
    if (captures.error) throw captures.error
    for (const row of [...(orders.data || []), ...(captures.data || [])]) {
      if (typeof row.pii_email_hash === 'string') optedIn.add(row.pii_email_hash)
    }
  }
  return candidates.filter(customer => {
    const hash = piiHash(customer.email)
    return Boolean(hash && optedIn.has(hash))
  })
}

function marketingFooter(unsubscribeUrl: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#173c2d;padding:18px 24px;text-align:center"><p style="color:rgba(255,255,255,.7);margin:0;font-size:12px;line-height:18px">Game of Bones · gameofbones.in</p><p style="margin:8px 0 0;font-size:12px;line-height:18px"><a href="${unsubscribeUrl}" style="color:#ffffff;text-decoration:underline">Unsubscribe from marketing emails</a></p></div>`
}

function marketingText(name: string, campaign: { headline?: string; body?: string; coupon?: string; cta?: string }, unsubscribeUrl: string) {
  return [
    'Game of Bones',
    campaign.headline || '',
    `Hi ${name}! ${campaign.body || ''}`,
    campaign.coupon ? `Use code at checkout: ${campaign.coupon}` : '',
    campaign.cta ? `${campaign.cta}: https://gameofbones.in` : 'Explore treats: https://gameofbones.in',
    `Unsubscribe from marketing emails: ${unsubscribeUrl}`,
  ].filter(Boolean).join('\\n\\n')
}

function buildDefaultHtml(name: string, campaign: any) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1008;padding:24px;text-align:center">
        <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
      </div>
      <div style="background:#f9f6f2;padding:32px;text-align:center">
        <h2 style="color:#1a1008;margin:0 0 16px">${campaign.headline}</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
          Hi ${name}! ${campaign.body}
        </p>
        ${campaign.coupon ? `
        <div style="background:white;border:2px dashed #c8973a;border-radius:16px;padding:20px;margin:0 0 24px">
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Use code at checkout</p>
          <div style="font-size:28px;font-weight:800;color:#c8973a;letter-spacing:4px">${campaign.coupon}</div>
        </div>` : ''}
        <a href="https://gameofbones.in"
          style="background:#c8973a;color:#1a1008;padding:14px 32px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block">
          ${campaign.cta} →
        </a>
      </div>
      <div style="background:#1a1008;padding:16px;text-align:center">
        <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
          Game of Bones · gameofbones.in · WhatsApp: +91 90825 03295
        </p>
      </div>
    </div>
  `
}
