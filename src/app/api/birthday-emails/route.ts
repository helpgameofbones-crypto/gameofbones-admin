import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  const { data: birthdays } = await supabase
    .from('dog_birthdays')
    .select('*')

  const todaysBirthdays = (birthdays || []).filter(b => {
    const bday = new Date(b.birthday)
    return bday.getMonth() + 1 === month && bday.getDate() === day
  })

  let sent = 0

  for (const b of todaysBirthdays) {
    if (!b.customer_email) continue
    const lastSent = b.last_email_sent ? new Date(b.last_email_sent) : null
    const alreadySentThisYear = lastSent && lastSent.getFullYear() === today.getFullYear()
    if (alreadySentThisYear) continue

    const couponCode = 'BDAY' + (b.dog_name || 'DOG').toUpperCase().slice(0, 4) + today.getFullYear()

    await supabase.from('coupons').insert({
      code: couponCode,
      type: 'percent',
      value: 15,
      min_order: 499,
      max_uses: 1,
      valid_from: today.toISOString().split('T')[0],
      valid_until: new Date(today.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: true,
    })

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: b.customer_email,
      subject: 'Happy Birthday ' + b.dog_name + '! A special treat awaits',
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1008;padding:24px;text-align:center"><h1 style="color:#c8973a;margin:0">Game of Bones</h1></div><div style="background:#f9f6f2;padding:32px;text-align:center"><h2 style="color:#1a1008">Happy Birthday ' + b.dog_name + '!</h2><p style="color:#6b7280">Hi ' + b.customer_name + ', here is a birthday gift for ' + b.dog_name + '</p><div style="background:white;border-radius:12px;padding:20px;margin:20px auto;max-width:300px;border:2px dashed #c8973a"><div style="font-size:32px;font-weight:bold;color:#1a1008">15% OFF</div><div style="font-size:14px;color:#6b7280;margin:8px 0">on orders above Rs 499</div><div style="background:#1a1008;color:#c8973a;padding:10px 20px;border-radius:6px;font-family:monospace;font-size:18px;font-weight:bold">' + couponCode + '</div><div style="font-size:11px;color:#9ca3af;margin-top:6px">Valid 48 hours only</div></div><a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">Shop Now</a></div></div>'
    })

    await supabase
      .from('dog_birthdays')
      .update({ last_email_sent: today.toISOString().split('T')[0] })
      .eq('id', b.id)

    sent++
  }

  return NextResponse.json({ ok: true, birthdays_today: todaysBirthdays.length, emails_sent: sent })
}
