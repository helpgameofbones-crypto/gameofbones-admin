import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, normalizePhoneForHash, piiHash, revealLegacyPii } from '@/app/lib/pii-crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-review-purchase', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const phone = normalizePhoneForHash(cleanText(body.phone, 20))
    const productName = cleanText(body.productName, 160).toLowerCase()
    if (!/^\d{10}$/.test(phone) || !productName) return NextResponse.json({ purchased: false }, { headers })
    const phoneHash = piiHash(phone)
    const { data, error } = await supabase.from('orders').select('items,customer_phone,pii_phone_ciphertext,pii_phone_hash').limit(5000)
    if (error) throw error
    const purchased = (data || []).some(order => {
      const orderPhone = normalizePhoneForHash(decryptPii(order.pii_phone_ciphertext) || revealLegacyPii(order.customer_phone))
      if (order.pii_phone_hash !== phoneHash && orderPhone !== phone) return false
      return Array.isArray(order.items) && order.items.some((item: Record<string, unknown>) => String(item.product_name || item.name || '').trim().toLowerCase() === productName)
    })
    return NextResponse.json({ purchased }, { headers })
  } catch { return NextResponse.json({ error: 'Unable to verify purchase' }, { status: 500, headers }) }
}
