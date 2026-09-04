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
  const source = request.nextUrl.searchParams.get('source') === 'customer' ? 'customer_birthdays' : 'dog_birthdays'
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from(source).select('*').order(source === 'dog_birthdays' ? 'created_at' : 'created_at', { ascending: false }).limit(5000)
  if (error) return NextResponse.json({ error: 'Unable to load birthdays.' }, { status: 500 })
  try {
    const birthdays = (data || []).map(row => ({
      ...row,
      customer_name: readable(row.pii_name_ciphertext, row.customer_name),
      customer_phone: readable(row.pii_phone_ciphertext, row.customer_phone),
      customer_email: readable(row.pii_email_ciphertext, row.customer_email),
      pii_name_ciphertext: undefined, pii_phone_ciphertext: undefined, pii_email_ciphertext: undefined,
      pii_name_hash: undefined, pii_phone_hash: undefined, pii_email_hash: undefined,
    }))
    return NextResponse.json({ birthdays })
  } catch {
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
