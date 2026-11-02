import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { gzipSync } from 'zlib'

// Weekly off-site backup. The database is on Supabase's free plan, which has
// no automatic backups, so every Sunday this exports the business tables to a
// gzipped JSON file and emails it to the store inbox. Customer details that
// are stored encrypted stay encrypted in the file (restore needs the same
// PII key from Vercel). Auth: proxy.ts checks the CRON_SECRET bearer token;
// this route checks it again so it can never run unauthenticated.
export const maxDuration = 60

const TABLES = [
  'orders', 'order_attempts', 'customers', 'customer_addresses', 'customer_dogs', 'customer_birthdays',
  'loyalty_ledger', 'rewards', 'referrals', 'coupons', 'coupon_usage', 'products', 'product_sizes',
  'product_reviews', 'reviews', 'testimonials', 'dog_birthdays', 'dog_gallery', 'email_captures',
  'abandoned_carts', 'contact_inquiries', 'nps_surveys', 'refunds', 'returns', 'privacy_requests',
  'production_batches', 'blogs', 'site_content', 'whatsapp_settings', 'whatsapp_optouts', 'ad_spend',
  'audit_log', 'activity_log',
]

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const dump: Record<string, unknown[]> = {}
  const counts: Record<string, number | string> = {}
  for (const table of TABLES) {
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999)
      if (error) { counts[table] = `error: ${error.message}`; break }
      rows.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    dump[table] = rows
    if (counts[table] === undefined) counts[table] = rows.length
  }
  const date = new Date().toISOString().slice(0, 10)
  const file = gzipSync(Buffer.from(JSON.stringify({ exported_at: new Date().toISOString(), tables: dump })))
  const summary = Object.entries(counts).map(([t, n]) => `${t}: ${n}`).join('\n')

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.BACKUP_EMAIL || process.env.GMAIL_USER,
    subject: `Game of Bones weekly backup ${date}`,
    text: `Weekly database backup attached (${Math.round(file.length / 1024)} KB, gzipped JSON).\n\nRows per table:\n${summary}\n\nKeep this email. Encrypted customer fields need the PII key in Vercel to read.`,
    attachments: [{ filename: `gob-backup-${date}.json.gz`, content: file, contentType: 'application/gzip' }],
  })
  return NextResponse.json({ ok: true, date, bytes: file.length, counts })
}
