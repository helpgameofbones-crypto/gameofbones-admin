import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

// Cron job: runs every hour, sends email to abandoned carts from 1-2 hours ago
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)

  const { data: carts } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('recovered', false)
    .not('customer_email', 'is', null)
    .gte('abandoned_at', twoHoursAgo.toISOString())
    .lt('abandoned_at', oneHourAgo.toISOString())

  let sent = 0
  for (const cart of carts || []) {
    const itemsHtml = (cart.items || []).map((i: any) =>
      `<div style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:13px;display:flex;justify-content:space-between">
        <span>${i.name} ${i.sizeLabel ? '· ' + i.sizeLabel : ''} × ${i.qty}</span>
        <span style="font-weight:600">Rs.${(i.price * i.qty).toLocaleString('en-IN')}</span>
      </div>`
    ).join('')

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f6f2;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#1a1008;padding:20px 28px;border-radius:8px 8px 0 0;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#c8973a">GAME OF BONES</div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px">You left something behind...</div>
  </div>
  <div style="background:white;padding:28px">
    <p style="font-size:15px;color:#1a1008">Hi ${cart.customer_name?.split(' ')[0] || 'there'},</p>
    <p style="font-size:14px;color:#5a4a3a;line-height:1.7">Your dog is still waiting! You left these treats in your cart — we've saved them for you.</p>
    <div style="margin:20px 0">${itemsHtml}</div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #f0ebe3;font-size:15px;font-weight:700">
      <span>Total</span><span style="color:#c8973a">Rs.${cart.total?.toLocaleString('en-IN')}</span>
    </div>
    <div style="text-align:center;margin-top:24px">
      <a href="https://gameofbones-website.vercel.app/?cart=recover&phone=${cart.customer_phone}" 
         style="display:inline-block;background:#c8973a;color:#1a1008;padding:14px 36px;font-weight:700;font-size:13px;text-decoration:none;border-radius:2px;letter-spacing:.1em">
        COMPLETE MY ORDER →
      </a>
    </div>
    <p style="font-size:12px;color:#8a7a6a;text-align:center;margin-top:20px">
      Use code <strong>SAVE50</strong> for Rs.50 off if you complete your order in the next 24 hours!
    </p>
  </div>
  <div style="background:#1a1008;padding:16px;text-align:center;border-radius:0 0 8px 8px">
    <p style="font-size:11px;color:rgba(255,255,255,.4);margin:0">Game of Bones · Made in Kalyan, Maharashtra</p>
  </div>
</div></body></html>`

    await resend.emails.send({
      from: 'Game of Bones <onboarding@resend.dev>',
      to: cart.customer_email,
      subject: `${cart.customer_name?.split(' ')[0] || 'Hey'}, your dog treats are waiting! 🐾`,
      html,
    })
    sent++
  }

  return NextResponse.json({ sent })
}
