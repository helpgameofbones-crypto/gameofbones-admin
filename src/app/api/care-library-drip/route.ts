import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─────────────────────────────────────────────────────────────────────────
// CARE LIBRARY DRIP
// Runs daily. Finds orders that were marked delivered 5-6 days ago and
// haven't had the care-library email sent yet, then emails the customer a
// links to the community-care resources (feeding/health log, vaccination
// and sterilization trackers, emergency contact sheet) plus a couple of
// relevant blog posts. This is meant to turn a one-time buyer into someone
// invested in the brand's street-dog-welfare mission, not just a treats
// customer — and it's a light-touch nudge that also drives repeat visits
// to the site.
// ─────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const SITE = 'https://gameofbones.in'
const CARE_LIBRARY_LINKS = [
  { label: 'Feeding & Health Log', url: `${SITE}/feeding-health-log.html`, blurb: 'A weekly log to track any community dogs you feed — health, behavior, follow-ups.' },
  { label: 'Sterilization Records', url: `${SITE}/sterilization-records.html`, blurb: 'ABC (Animal Birth Control) surgery tracker, plus free sterilization programs in Mumbai.' },
  { label: 'Vaccination Records', url: `${SITE}/vaccination-records.html`, blurb: 'Track rabies and other vaccinations for dogs you look after.' },
  { label: 'Emergency Contact Sheet', url: `${SITE}/emergency-contacts.html`, blurb: 'Rescue orgs and vets across Mumbai, organized by area — print & save.' },
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sixDaysAgo = new Date()
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_phone, delivered_at, care_library_sent')
    .eq('status', 'delivered')
    .eq('care_library_sent', false)
    .gte('delivered_at', sixDaysAgo.toISOString())
    .lte('delivered_at', fiveDaysAgo.toISOString())

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let sent = 0
  const results: any[] = []

  for (const order of orders || []) {
    // customers.email/phone are stored in plain text (unlike orders.customer_phone,
    // which may be XOR+base64 encrypted), so look the customer up by phone here.
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email, phone, dog_name')
      .eq('phone', order.customer_phone)
      .maybeSingle()

    if (!customer?.email) {
      results.push({ order_id: order.id, skipped: 'no customer email on file' })
      continue
    }

    const firstName = (customer.name || order.customer_name || 'there').split(' ')[0]
    const dogLine = customer.dog_name
      ? `and give ${customer.dog_name} an extra treat from us`
      : `and give your pup an extra treat from us`

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: customer.email,
        subject: `A few resources for you (and the strays in your neighborhood) 🐾`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a1008;padding:24px;text-align:center">
              <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            </div>
            <div style="background:#f9f6f2;padding:32px">
              <h2 style="color:#1a1008;margin:0 0 8px">Hi ${firstName}!</h2>
              <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px">
                Your order should have settled in by now — hope your dog is enjoying the treats,
                ${dogLine}. Beyond treats, Game of Bones also supports community dogs across Mumbai.
                If you ever feed or look after a street dog, these free resources might help:
              </p>
              ${CARE_LIBRARY_LINKS.map(l => `
                <div style="background:white;border-radius:12px;padding:16px 20px;margin-bottom:12px;border-left:4px solid #c8973a">
                  <a href="${l.url}" style="color:#1a1008;font-weight:700;font-size:15px;text-decoration:none">${l.label} →</a>
                  <div style="color:#6b7280;font-size:12px;margin-top:4px">${l.blurb}</div>
                </div>
              `).join('')}
              <div style="text-align:center;margin-top:24px">
                <a href="${SITE}" style="background:#c8973a;color:#1a1008;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block">
                  Visit Game of Bones →
                </a>
              </div>
            </div>
            <div style="background:#1a1008;padding:16px;text-align:center">
              <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
                Game of Bones · gameofbones.in · You're receiving this because you ordered from us
              </p>
            </div>
          </div>
        `
      })

      await supabase.from('orders').update({ care_library_sent: true }).eq('id', order.id)
      sent++
      results.push({ order_id: order.id, sent_to: customer.email })
    } catch (e: any) {
      results.push({ order_id: order.id, error: e?.message || 'send failed' })
    }
  }

  return NextResponse.json({
    ok: true,
    orders_checked: orders?.length || 0,
    emails_sent: sent,
    details: results,
  })
}
