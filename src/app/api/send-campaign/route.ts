import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { customers, campaign } = await req.json()
    let sent = 0

    for (const customer of customers) {
      if (!customer.email) continue

      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: customer.email,
        subject: campaign.subject,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a1008;padding:24px;text-align:center">
              <h1 style="color:#c8973a;margin:0">🐾 Game of Bones</h1>
            </div>
            <div style="background:#f9f6f2;padding:32px">
              <h2 style="color:#1a1008;margin:0 0 16px">${campaign.headline}</h2>
              <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
                Hi ${customer.name},<br/><br/>${campaign.body}
              </p>
              ${campaign.coupon ? `
              <div style="background:white;border:2px dashed #c8973a;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.1em">Your Code</div>
                <div style="font-size:28px;font-weight:bold;color:#1a1008;font-family:monospace;letter-spacing:.1em">${campaign.coupon}</div>
              </div>` : ''}
              <div style="text-align:center">
                <a href="https://gameofbones.in"
                  style="background:#c8973a;color:#1a1008;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block">
                  ${campaign.cta} →
                </a>
              </div>
            </div>
            <div style="background:#1a1008;padding:16px;text-align:center">
              <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
                Game of Bones · gameofbones.in
              </p>
            </div>
          </div>
        `
      })
      sent++
    }

    return NextResponse.json({ ok: true, sent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}