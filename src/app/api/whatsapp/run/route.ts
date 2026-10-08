import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/app/lib/whatsapp'
import { runAll } from '@/app/lib/whatsapp-runner'

export const maxDuration = 60

// Called every 15 minutes by Supabase pg_cron (job "whatsapp-runner").
async function authorised(req: NextRequest, cronKey: string) {
  const header = req.headers.get('x-whatsapp-cron-key')
  if (header && header === cronKey) return true
  if (process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true
  return false
}

export async function GET(req: NextRequest) {
  const settings = await getSettings()
  if (!(await authorised(req, settings.cron_key))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await runAll(settings))
}
