import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function OPTIONS(req: NextRequest) {
    return NextResponse.json({}, { headers: corsHeaders(req) })
}

function randomCode(len: number) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let s = ''
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
}

// Generates a single-use 10%-off coupon for a cart-abandoner. Runs
// server-side with the service-role key because the `coupons` table's RLS
// only allows INSERT for the authenticated (admin) role -- the storefront's
// anon key cannot write coupons directly.
async function generateCoupon(): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
          const code = 'SAVE10-' + randomCode(5)
          const { data: existing } = await supabase.from('coupons').select('id').eq('code', code).limit(1)
          if (existing && existing.length > 0) continue
          const now = new Date()
          const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          const { error } = await supabase.from('coupons').insert({
                  code,
                  type: 'percent',
                  value: '10',
                  min_order: null,
                  max_uses: 1,
                  usagelimit: 1,
                  usagepercustomer: 1,
                  valid_from: now.toISOString().slice(0, 10),
                  valid_until: until.toISOString().slice(0, 10),
                  is_active: true,
          })
          if (!error) return code
    }
    return null
}

export async function POST(req: NextRequest) {
    const headers = corsHeaders(req)
    try {
      const originError = rejectUnexpectedOrigin(req)
      if (originError) return originError
      const limitError = rateLimit(req, 'abandoned-cart', 3, 60 * 60 * 1000)
      if (limitError) return limitError
          const { phone, email, name, items, total } = await req.json()
          const normalizedPhone = cleanText(phone, 20).replace(/^\+?91/, '')
          const normalizedEmail = cleanText(email, 254)
          const normalizedName = cleanText(name, 100)
          if (!/^\d{10}$/.test(normalizedPhone) || !Array.isArray(items) || items.length < 1 || items.length > 25 || !Number.isFinite(Number(total)) || Number(total) < 1 || Number(total) > 100000) {
                  return NextResponse.json({ ok: true }, { headers })
          }

      // Reuse the coupon already issued to this phone number, if any, so
      // re-syncing the same cart (e.g. adding another item) doesn't mint a
      // fresh code every time.
      const { data: existingCart } = await supabase
            .from('abandoned_carts')
            .select('coupon_code')
            .eq('customer_phone', normalizedPhone)
            .limit(1)

      let couponCode: string | null = (existingCart && existingCart[0] && existingCart[0].coupon_code) || null
          if (!couponCode) {
                  couponCode = await generateCoupon()
          }

      await supabase.from('abandoned_carts').upsert({
              customer_phone: normalizedPhone,
              customer_email: normalizedEmail || null,
              customer_name: normalizedName || null,
              items: items.slice(0, 25), total: Number(total),
              abandoned_at: new Date().toISOString(),
              recovered: false,
              coupon_code: couponCode,
      }, { onConflict: 'customer_phone' })

      return NextResponse.json({ ok: true, coupon_code: couponCode }, { headers })
    } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 500, headers })
    }
}
