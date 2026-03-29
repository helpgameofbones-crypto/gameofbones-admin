import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo  = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const eightDaysAgo  = new Date()
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'delivered')
    .gte('updated_at', eightDaysAgo.toISOString())
    .lte('updated_at', sevenDaysAgo.toISOString())

  let sent = 0

  for (const order of (deliveredOrders || [])) {
    if (!order.customer_email) continue

    const { data: existing } = await supabase
      .from('nps_surveys')
      .select('id')
      .eq('order_id', order.id)
      .single()

    if (existing) continue

    const { data: survey } = await supabase
      .from('nps_surveys')
      .insert({
        order_id:       order.id,
        customer_phone: order.customer_phone,
        customer_name:  order.customer_name,
        customer_email: order.customer_email,
        sent_at:        new Date().toISOString(),
      })
      .select()
      .single()

    if (!survey) continue

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: order.customer_email,
      subject: `How was your experience with Game of Bones? 🐾`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1008;padding:24px;text-align:center">
            <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
          </div>
          <div style="background:#f9f6f2;padding:32px;text-align:center">
            <h2 style="color:#1a1008;margin:0 0 8px">How likely are you to recommend us?</h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
              Hi ${order.customer_name}! Your order ${order.ref} was delivered 7 days ago.
              We'd love to know how your experience was.
            </p>
            <div style="margin-bottom:24px">
              <div style="font-size:12px;color:#9ca3af;margin-bottom:12px">
                0 = Not at all likely &nbsp;&nbsp; 10 = Extremely likely
              </div>
              <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
                ${[0,1,2,3,4,5,6,7,8,9,10].map(score => `
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/api/nps-survey?id=${survey.id}&score=${score}"
                    style="width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
                    text-decoration:none;font-weight:bold;font-size:14px;
                    background:${score <= 6 ? '#fef2f2' : score <= 8 ? '#fef3c7' : '#dcfce7'};
                    color:${score <= 6 ? '#ef4444' : score <= 8 ? '#92400e' : '#166534'}">
                    ${score}
                  </a>
                `).join('')}
              </div>
            </div>
            <p style="color:#9ca3af;font-size:12px">
              Click a number to submit your rating. Takes 2 seconds!
            </p>
          </div>
          <div style="background:#1a1008;padding:16px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">Game of Bones · gameofbones.in</p>
          </div>
        </div>
      `
    })
    sent++
  }

  return NextResponse.json({ ok: true, emails_sent: sent })
}

export async function POST(req: NextRequest) {
  const { id, score, feedback } = await req.json()
  await supabase
    .from('nps_surveys')
    .update({ score, feedback, responded_at: new Date().toISOString() })
    .eq('id', id)
  return NextResponse.json({ ok: true })
}