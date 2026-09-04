import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BATCH_SIZE = 100

function authorised(request: NextRequest) {
  return Boolean(process.env.CRON_SECRET) && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

// This is deliberately an authenticated, repeatable batch job. It only adds the
// AES-GCM fields and hashes; it never deletes the legacy columns. Those fields can
// be retired separately after the migration report shows zero records remaining.
async function migrate(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { data: rows, error } = await supabase.from('orders')
      .select('id,customer_name,customer_phone,customer_email,shipping_address,pii_name_ciphertext,pii_phone_ciphertext,pii_email_ciphertext,pii_address_ciphertext,pii_phone_hash,pii_email_hash')
      .or('pii_name_ciphertext.is.null,pii_phone_ciphertext.is.null,pii_email_ciphertext.is.null,pii_address_ciphertext.is.null,pii_phone_hash.is.null,pii_email_hash.is.null')
      .limit(BATCH_SIZE)
    if (error) throw error

    let migrated = 0
    const failures: string[] = []
    for (const row of rows || []) {
      try {
        const name = revealLegacyPii(row.customer_name)
        const phone = revealLegacyPii(row.customer_phone)
        const email = revealLegacyPii(row.customer_email)
        const address = revealLegacyPiiValue(row.shipping_address)
        const update = {
          pii_name_ciphertext: row.pii_name_ciphertext || encryptPii(name),
          pii_phone_ciphertext: row.pii_phone_ciphertext || encryptPii(phone),
          pii_email_ciphertext: row.pii_email_ciphertext || encryptPii(email),
          pii_address_ciphertext: row.pii_address_ciphertext || encryptPii(address),
          pii_phone_hash: row.pii_phone_hash || piiHash(normalizePhoneForHash(phone)),
          pii_email_hash: row.pii_email_hash || piiHash(normalizeEmailForHash(email)),
          pii_key_version: 1,
        }
        const { error: updateError } = await supabase.from('orders').update(update).eq('id', row.id)
        if (updateError) throw updateError
        migrated += 1
      } catch (error) {
        failures.push(String(row.id))
        console.error('PII migration failed for order', row.id, error)
      }
    }
    return NextResponse.json({ ok: true, scanned: rows?.length || 0, migrated, failedIds: failures, remainingMayExist: (rows?.length || 0) === BATCH_SIZE })
  } catch (error) {
    console.error('Legacy PII migration failed', error)
    return NextResponse.json({ error: 'Unable to migrate historical customer data.' }, { status: 500 })
  }
}

// Vercel Cron invokes GET. POST remains available for an authenticated manual
// run when an operator wants to migrate additional batches immediately.
export async function GET(request: NextRequest) {
  return migrate(request)
}

export async function POST(request: NextRequest) {
  return migrate(request)
}
