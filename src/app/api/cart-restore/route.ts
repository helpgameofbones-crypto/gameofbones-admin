import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit } from '@/app/lib/public-request'

// Restores a saved bag from the link in a WhatsApp cart reminder
// (https://gameofbones.in/cart?restore=TOKEN). Returns only the bag contents,
// never any customer details. Checkout re-prices everything server-side.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function GET(req: NextRequest) {
  const headers = corsHeaders(req)
  const limitError = await rateLimit(req, 'cart-restore', 30, 60 * 60 * 1000); if (limitError) return limitError
  const token = String(req.nextUrl.searchParams.get('token') || '')
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(token)) return NextResponse.json({ found: false }, { headers })
  const { data } = await db.from('abandoned_carts').select('cart_lines,items,coupon_code').eq('restore_token', token).maybeSingle()
  if (!data) return NextResponse.json({ found: false }, { headers })
  return NextResponse.json({ found: true, lines: Array.isArray(data.cart_lines) ? data.cart_lines : [], items: Array.isArray(data.items) ? data.items : [], coupon_code: data.coupon_code || null }, { headers })
}
