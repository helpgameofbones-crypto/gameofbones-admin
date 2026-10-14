import { NextRequest, NextResponse } from 'next/server'
import { db, getSettings } from '@/app/lib/whatsapp'
import { runAll } from '@/app/lib/whatsapp-runner'
import { runPaymentDropoutEmails } from '@/app/lib/payment-dropout'

export const maxDuration = 60

// Called every 15 minutes by Supabase pg_cron (job "whatsapp-runner").
// Besides WhatsApp (which only acts when switched on), this also sends the
// payment-dropout follow-up email, which needs the 15-minute cadence that
// Vercel's daily crons cannot give.
async function authorised(req: NextRequest, cronKey: string) {
  const header = req.headers.get('x-whatsapp-cron-key')
  if (header && header === cronKey) return true
  if (process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true
  return false
}

export async function GET(req: NextRequest) {
  const settings = await getSettings()
  if (!(await authorised(req, settings.cron_key))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let paymentDropout: unknown
  try { paymentDropout = await runPaymentDropoutEmails(db) } catch (error) { console.error('[run] payment dropout emails failed', error); paymentDropout = { error: 'failed' } }
  const whatsapp = await runAll(settings)
  return NextResponse.json({ ...whatsapp, payment_dropout: paymentDropout })
}
