import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'
import { birthdayOfferEmail, ensureBirthdayOffer } from '@/app/lib/birthday-offer'

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

    const offer = await ensureBirthdayOffer(supabase, b, today)
    const email = birthdayOfferEmail(b, offer.code)
    await resend.emails.send({
      to: b.customer_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    await supabase
      .from('dog_birthdays')
      .update({ last_email_sent: today.toISOString().split('T')[0] })
      .eq('id', b.id)

    sent++
  }

  return NextResponse.json({ ok: true, birthdays_today: todaysBirthdays.length, emails_sent: sent })
}
