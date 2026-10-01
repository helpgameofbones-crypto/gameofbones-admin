import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
function randomCode(len: number) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let value = ''; for (let i = 0; i < len; i++) value += chars[Math.floor(Math.random() * chars.length)]; return value }
async function generateCoupon(): Promise<string | null> {
 for (let attempt = 0; attempt < 5; attempt++) {
  const code = 'SAVE10-' + randomCode(5), existing = await supabase.from('coupons').select('id').eq('code', code).limit(1)
  if (existing.data?.length) continue
  const now = new Date(), until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const { error } = await supabase.from('coupons').insert({ code, type:'percent', value:'10', min_order:null, max_uses:1, usagelimit:1, usagepercustomer:1, valid_from:now.toISOString().slice(0,10), valid_until:until.toISOString().slice(0,10), is_active:true })
  if (!error) return code
 }
 return null
}
function validCartToken(value: unknown) { return /^cart_[A-Za-z0-9_-]{20,80}$/.test(cleanText(value, 90)) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = await rateLimit(req, 'abandoned-cart', 10, 60 * 60 * 1000); if (limitError) return limitError
  const { phone, email, name, items, total, cart_token: incomingCartToken } = await req.json()
  const normalizedPhone = cleanText(phone,20).replace(/^\+?91/, ''), normalizedEmail=cleanText(email,254), normalizedName=cleanText(name,100)
  const cartToken = validCartToken(incomingCartToken) ? cleanText(incomingCartToken,90) : ''
  const hasPhone = /^\d{10}$/.test(normalizedPhone)
  // Record a bag immediately. Contact details are optional and are only added
  // when the shopper has actually entered them at checkout.
  if ((!hasPhone && !cartToken) || !Array.isArray(items) || items.length < 1 || items.length > 25 || !Number.isFinite(Number(total)) || Number(total) < 1 || Number(total) > 100000) return NextResponse.json({ ok:true }, { headers })
  let existing: { id:string; coupon_code:string|null }|null = null
  if (hasPhone) { const current = await supabase.from('abandoned_carts').select('id,coupon_code').eq('customer_phone', normalizedPhone).maybeSingle(); if (current.error) throw current.error; existing=current.data }
  if (!existing && cartToken) { const current = await supabase.from('abandoned_carts').select('id,coupon_code').eq('cart_token', cartToken).maybeSingle(); if (current.error) throw current.error; existing=current.data }
  const couponCode = existing?.coupon_code || (hasPhone ? await generateCoupon() : null)
  const payload = { customer_phone:hasPhone?normalizedPhone:null, customer_email:hasPhone?(normalizedEmail||null):null, customer_name:hasPhone?(normalizedName||null):null, pii_phone_ciphertext:hasPhone?encryptPii(normalizedPhone):null, pii_email_ciphertext:hasPhone?encryptPii(normalizedEmail):null, pii_name_ciphertext:hasPhone?encryptPii(normalizedName):null, pii_phone_hash:hasPhone?piiHash(normalizePhoneForHash(normalizedPhone)):null, pii_email_hash:hasPhone?piiHash(normalizeEmailForHash(normalizedEmail)):null, pii_key_version:hasPhone?1:0, cart_token:cartToken||null, items:items.slice(0,25), total:Number(total), abandoned_at:new Date().toISOString(), recovered:false, coupon_code:couponCode }
  const result = existing ? await supabase.from('abandoned_carts').update(payload).eq('id',existing.id) : await supabase.from('abandoned_carts').insert(payload)
  if (result.error) throw result.error
  return NextResponse.json({ ok:true, coupon_code:couponCode }, { headers })
 } catch { return NextResponse.json({ ok:true }, { headers }) }
}
