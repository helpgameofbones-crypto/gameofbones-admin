import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { decryptPii, revealLegacyPii } from '@/app/lib/pii-crypto'
import { requireAdmin } from '@/app/lib/requireAdmin'

function readable(ciphertext: unknown, legacy: unknown): string {
  if (typeof ciphertext === 'string' && ciphertext) return decryptPii(ciphertext)
  return revealLegacyPii(legacy)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const source = request.nextUrl.searchParams.get('source')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const table = source === 'reorder' ? 'reorder_alerts' : 'abandoned_carts'
  const query = table === 'reorder_alerts'
    ? db.from(table).select('*').order('days_since_last_order', { ascending: false }).limit(2000)
    : db.from(table).select('*').order('abandoned_at', { ascending: false }).limit(1000)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load retention data.' }, { status: 500 })
  try {
    const rows = (data || []).map(row => ({ ...row, customer_name: readable(row.pii_name_ciphertext, row.customer_name), customer_phone: readable(row.pii_phone_ciphertext, row.customer_phone), customer_email: readable(row.pii_email_ciphertext, row.customer_email), pii_name_ciphertext: undefined, pii_phone_ciphertext: undefined, pii_email_ciphertext: undefined, pii_name_hash: undefined, pii_phone_hash: undefined, pii_email_hash: undefined }))
    return NextResponse.json({ rows })
  } catch { return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null
  if (typeof body?.id !== 'number' || !['sent', 'dismissed'].includes(String(body.status))) return NextResponse.json({ error: 'A valid alert and action are required.' }, { status: 400 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await db.from('reorder_alerts').update({ alert_status: body.status }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update alert.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
