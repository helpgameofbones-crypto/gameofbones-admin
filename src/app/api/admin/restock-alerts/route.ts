import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { decryptPii } from '@/app/lib/pii-crypto'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const readable = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null
  try { return decryptPii(value) || null } catch { return null }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const { data, error } = await database().from('restock_alerts')
    .select('id,product_id,product_name,pii_email_ciphertext,pii_phone_ciphertext,notification_consent,status,notified_at,created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return NextResponse.json({ error: 'Unable to load stock alerts.' }, { status: 500 })
  return NextResponse.json({ alerts: (data || []).map((alert: Record<string, unknown>) => ({
    ...alert,
    email: readable(alert.pii_email_ciphertext),
    phone: readable(alert.pii_phone_ciphertext),
    pii_email_ciphertext: undefined,
    pii_phone_ciphertext: undefined,
  })) })
}
