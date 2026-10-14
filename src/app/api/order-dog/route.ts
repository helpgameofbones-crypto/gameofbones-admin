import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash, revealLegacyPii } from '@/app/lib/pii-crypto'

// Thank-you page popup: "Tell us about your dog" (name, breed, birthday).
// Tied to the order just placed (its reference is in the thank-you URL), so
// the shopper does not retype contact details. Saves the dog to the customer
// profile and to dog_birthdays, which drives the 25% birthday offer email.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const REF_RE = /^[A-Za-z0-9-]{3,40}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const reveal = (cipher: unknown, legacy: unknown) => { try { return decryptPii(typeof cipher === 'string' ? cipher : null) || revealLegacyPii(legacy) } catch { try { return revealLegacyPii(legacy) } catch { return '' } } }

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = await rateLimit(req, 'order-dog', 10, 24 * 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const ref = cleanText(body.ref, 40), dogName = cleanText(body.dog_name, 80), breed = cleanText(body.breed, 80), birthday = cleanText(body.birthday, 10)
    if (!REF_RE.test(ref) || !dogName || !DATE_RE.test(birthday)) return NextResponse.json({ error: 'Please add your dog’s name and birthday.' }, { status: 400, headers })
    const born = new Date(`${birthday}T00:00:00Z`)
    if (Number.isNaN(born.getTime()) || born.getTime() > Date.now() || born.getUTCFullYear() < 1995) return NextResponse.json({ error: 'Please check the birthday date.' }, { status: 400, headers })

    // Only a recent, real order can attach a dog.
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: order, error } = await supabase.from('orders')
      .select('id,ref,status,customer_name,customer_phone,customer_email,pii_name_ciphertext,pii_phone_ciphertext,pii_email_ciphertext')
      .eq('ref', ref).gte('created_at', since).maybeSingle()
    if (error) throw error
    if (!order || /^cancel/i.test(String(order.status || ''))) return NextResponse.json({ error: 'We could not find this order. Please try again from your account.' }, { status: 404, headers })

    const phone = reveal(order.pii_phone_ciphertext, order.customer_phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    const email = reveal(order.pii_email_ciphertext, order.customer_email).trim().toLowerCase()
    const name = reveal(order.pii_name_ciphertext, order.customer_name).trim()
    const phoneHash = phone ? piiHash(normalizePhoneForHash(phone)) : null
    const emailHash = email ? piiHash(normalizeEmailForHash(email)) : null

    // One birthday row per dog per customer: update instead of duplicating.
    const owner = [phoneHash && `pii_phone_hash.eq.${phoneHash}`, emailHash && `pii_email_hash.eq.${emailHash}`].filter(Boolean) as string[]
    const existing = owner.length
      ? await supabase.from('dog_birthdays').select('id,dog_name').or(owner.join(',')).limit(20)
      : { data: [] as Array<{ id: string; dog_name: string }>, error: null }
    if (existing.error) throw existing.error
    const sameDog = (existing.data || []).find(row => String(row.dog_name || '').trim().toLowerCase() === dogName.toLowerCase())
    const row = { dog_name: dogName, birthday, customer_name: name || null, customer_email: email || null, customer_phone: phone || null, pii_name_ciphertext: encryptPii(name), pii_email_ciphertext: encryptPii(email), pii_phone_ciphertext: encryptPii(phone), pii_email_hash: emailHash, pii_phone_hash: phoneHash, pii_key_version: 1 }
    const saved = sameDog
      ? await supabase.from('dog_birthdays').update(row).eq('id', sameDog.id)
      : await supabase.from('dog_birthdays').insert(row)
    if (saved.error) throw saved.error

    if (phone) {
      const { error: dogError } = await supabase.rpc('upsert_customer_dog', { p_id: null, p_phone: phone, p_name: dogName, p_breed: breed, p_age: '', p_weight: '', p_preferences: '', p_birthday: birthday })
      if (dogError) console.error('[order-dog] customer dog profile save failed', dogError)
    }
    return NextResponse.json({ ok: true, has_email: Boolean(email) }, { headers })
  } catch (error) {
    console.error('[order-dog] failed', error)
    return NextResponse.json({ error: 'We could not save this right now. Please try again.' }, { status: 500, headers })
  }
}
