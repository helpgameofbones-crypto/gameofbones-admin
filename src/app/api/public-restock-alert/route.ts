import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{10,13}$/

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request)
    if (originError) return originError
    const limited = await rateLimit(request, 'public-restock-alert', 5, 60 * 60 * 1000)
    if (limited) return limited

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const productId = cleanText(body?.product_id, 100)
    const email = cleanText(body?.email, 254).toLowerCase()
    const phone = cleanText(body?.phone, 20)
    const consent = body?.notification_consent === true
    if (!productId || (!EMAIL_RE.test(email) && !PHONE_RE.test(phone)) || !consent) {
      return NextResponse.json({ error: 'Enter a valid email address or mobile number and agree to the stock alert.' }, { status: 400, headers })
    }

    const { data: product, error: productError } = await database()
      .from('products')
      .select('id,name,stock,is_active')
      .eq('id', productId)
      .maybeSingle()
    if (productError || !product || !product.is_active) {
      return NextResponse.json({ error: 'This treat is no longer available for alerts.' }, { status: 404, headers })
    }
    if (Number(product.stock) >= 10) {
      return NextResponse.json({ error: 'This treat is currently well stocked.' }, { status: 409, headers })
    }

    const contactHash = piiHash(email ? normalizeEmailForHash(email) : normalizePhoneForHash(phone))
    if (!contactHash) return NextResponse.json({ error: 'Unable to save this alert.' }, { status: 400, headers })
    const payload = {
      product_id: String(product.id),
      product_name: cleanText(product.name, 300),
      contact_hash: contactHash,
      pii_email_ciphertext: encryptPii(email),
      pii_phone_ciphertext: encryptPii(phone),
      notification_consent: true,
      privacy_notice_version: cleanText(body?.privacy_notice_version, 40) || '2026-10-15',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    const { error } = await database().from('restock_alerts').upsert(payload, { onConflict: 'product_id,contact_hash' })
    if (error) throw error
    return NextResponse.json({ ok: true }, { status: 201, headers })
  } catch (error) {
    console.error('[public-restock-alert] failed', error)
    return NextResponse.json({ error: 'Unable to save your stock alert. Please try again shortly.' }, { status: 500, headers })
  }
}
