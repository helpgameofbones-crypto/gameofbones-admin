import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { resend } from '@/app/lib/emailClient'
import { birthdayCouponCode, birthdayOfferEmail, ensureBirthdayOffer } from '@/app/lib/birthday-offer'

export const dynamic = 'force-dynamic'

const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OCTOBER_OFFER = {
  codePrefix: 'BDAYOCT25',
  discountPercent: 25,
  minimumOrder: 0,
  // Coupons use date-based expiry, so this remains usable through 31 October in India.
  validUntil: new Date('2026-10-31T18:29:59.000Z'),
}

function readableEmail(row: Record<string, unknown>) {
  const email = typeof row.customer_email === 'string' ? row.customer_email.trim().toLowerCase() : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { data, error } = await database.from('dog_birthdays').select('*')
  if (error) return NextResponse.json({ error: 'Unable to load birthday recipients.' }, { status: 500 })

  const candidates = (data || []).filter(row => {
    const birthday = new Date(String(row.birthday || ''))
    return birthday.getUTCMonth() === 9 && Boolean(readableEmail(row))
  })
  const sent: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const birthday of candidates) {
    const code = birthdayCouponCode(String(birthday.id), new Date().getUTCFullYear(), OCTOBER_OFFER.codePrefix)
    const { data: existing, error: lookupError } = await database.from('coupons').select('id').eq('code', code).maybeSingle()
    if (lookupError) { failed.push(String(birthday.dog_name || 'Unknown dog')); continue }
    // A campaign code means this recipient was already processed. This prevents a
    // second click from producing duplicate birthday emails.
    if (existing) { skipped.push(String(birthday.dog_name || 'Unknown dog')); continue }
    try {
      const offer = await ensureBirthdayOffer(database, birthday, new Date(), OCTOBER_OFFER)
      const email = readableEmail(birthday)
      const message = birthdayOfferEmail({ ...birthday, customer_email: email }, offer.code, OCTOBER_OFFER)
      const result = await resend.emails.send({ to: email, subject: message.subject, html: message.html, text: message.text })
      if (result.error) throw new Error(result.error.message)
      await database.from('dog_birthdays').update({ last_email_sent: new Date().toISOString() }).eq('id', birthday.id)
      sent.push(String(birthday.dog_name || 'Unknown dog'))
    } catch {
      failed.push(String(birthday.dog_name || 'Unknown dog'))
    }
  }

  await database.from('activity_log').insert({
    action: 'birthday campaign sent', entity_type: 'campaign', entity_name: 'October birthday 2026',
    details: `25% off, no minimum order: sent ${sent.length}; skipped ${skipped.length}; failed ${failed.length}.`,
  })
  return NextResponse.json({ ok: true, eligible: candidates.length, sent, skipped, failed })
}
