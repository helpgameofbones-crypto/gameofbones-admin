import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
 const headers = corsHeaders(req)
 try {
  const originError = rejectUnexpectedOrigin(req); if (originError) return originError
  const limitError = rateLimit(req, 'public-dog-birthday', 5, 24 * 60 * 60 * 1000); if (limitError) return limitError
  const body = await req.json(), dogName = cleanText(body.dog_name,100), customerName=cleanText(body.customer_name,100), customerEmail=cleanText(body.customer_email,254).toLowerCase(), customerPhone=cleanText(body.customer_phone,20), birthday=cleanText(body.birthday,10)
  if (!dogName || !DATE_RE.test(birthday) || (customerEmail && !EMAIL_RE.test(customerEmail)) || (customerPhone && !/^\+?\d{10,13}$/.test(customerPhone))) return NextResponse.json({ error: 'Invalid birthday details' }, { status: 400, headers })
  const { error } = await supabase.from('dog_birthdays').insert({ dog_name:dogName, customer_name:customerName||null, customer_email:customerEmail||null, customer_phone:customerPhone||null, birthday, pii_name_ciphertext:encryptPii(customerName), pii_email_ciphertext:encryptPii(customerEmail), pii_phone_ciphertext:encryptPii(customerPhone), pii_email_hash:piiHash(normalizeEmailForHash(customerEmail)), pii_phone_hash:piiHash(normalizePhoneForHash(customerPhone)), pii_key_version:1 })
  if (error) throw error
  return NextResponse.json({ ok:true }, { status:201, headers })
 } catch { return NextResponse.json({ error:'Unable to save birthday details' }, { status:500, headers }) }
}
