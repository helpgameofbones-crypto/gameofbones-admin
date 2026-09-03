import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Za-z0-9-]{3,40}$/, PHONE_RE = /^\+?\d{10,13}$/
function validItems(items: unknown): items is Array<{name:string;price:number;quantity:number}> { return Array.isArray(items) && items.length > 0 && items.length <= 50 && items.every(item => item && typeof item.name === 'string' && typeof item.price === 'number' && Number.isFinite(item.price) && typeof item.quantity === 'number' && Number.isFinite(item.quantity)) }
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = rateLimit(req, 'save-order', 5, 10 * 60 * 1000); if (limitError) return limitError
  const order = await req.json(), phone = revealLegacyPii(order.customer_phone), email = revealLegacyPii(order.customer_email), name = revealLegacyPii(order.customer_name)
  if (!order.ref || !phone) return NextResponse.json({ error:'Missing required fields: ref, customer_phone' }, { status:400, headers })
  if (!REF_RE.test(order.ref) || !PHONE_RE.test(phone) || !validItems(order.items) || ![order.total_amount,order.shipping,order.discount,order.grand_total].every((value:unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0) || order.grand_total < 1 || order.grand_total > 100000 || !['cod','razorpay'].includes(order.payment_method)) return NextResponse.json({ error:'Invalid order details' }, { status:400, headers })
  const { data: existing } = await supabase.from('orders').select('id').eq('ref',order.ref).limit(1)
  if (existing?.length) return NextResponse.json({ error:'Order reference already exists' }, { status:409, headers })
  const insertData: Record<string, unknown> = { ref:order.ref, customer_name:order.customer_name, customer_phone:order.customer_phone, customer_email:order.customer_email, pii_name_ciphertext:encryptPii(name), pii_phone_ciphertext:encryptPii(phone), pii_email_ciphertext:encryptPii(email), pii_address_ciphertext:encryptPii(revealLegacyPiiValue(order.shipping_address)), pii_phone_hash:piiHash(normalizePhoneForHash(phone)), pii_email_hash:piiHash(normalizeEmailForHash(email)), pii_key_version:1, items:order.items, total_amount:order.total_amount, shipping:order.shipping, discount:order.discount, grand_total:order.grand_total, payment_method:order.payment_method, shipping_address:order.shipping_address, notes:order.notes, payment_status:order.payment_method === 'cod' ? 'pending_cod' : 'pending', status:order.payment_method === 'cod' ? 'confirmed' : 'pending_payment' }
  const { error, data } = await supabase.from('orders').insert([insertData]).select()
  if (error) return NextResponse.json({ error:error.message }, { status:400, headers })
  fetch('https://gameofbones-admin.vercel.app/api/order-confirmation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})}).catch(() => undefined)
  return NextResponse.json({ success:true, order:data }, { status:201, headers })
 } catch (e: unknown) { return NextResponse.json({ error:e instanceof Error ? e.message : 'Unable to save order' }, { status:500, headers }) }
}
