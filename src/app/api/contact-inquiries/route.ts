import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { decryptPii, encryptPii, normalizeEmailForHash, piiHash } from '@/app/lib/pii-crypto'
import { requireAdmin } from '@/app/lib/requireAdmin'

const SUBJECTS = new Set(['Product question', 'Existing order', 'Shipping question', 'Wholesale / partnership', 'Something else'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const database = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  try {
    const originError = rejectUnexpectedOrigin(request); if (originError) return originError
    const limitError = rateLimit(request, 'contact-inquiry', 5, 60 * 60 * 1000); if (limitError) return limitError
    const body = await request.json().catch(() => ({}))
    const name = cleanText(body.name, 100)
    const email = cleanText(body.email, 254).toLowerCase()
    const subject = cleanText(body.subject, 80)
    const message = cleanText(body.message, 5000)
    if (name.length < 2 || !EMAIL_RE.test(email) || !SUBJECTS.has(subject) || message.length < 10) {
      return NextResponse.json({ error: 'Please complete each field with valid details.' }, { status: 400, headers })
    }
    const { error } = await database().from('contact_inquiries').insert({
      subject,
      pii_name_ciphertext: encryptPii(name),
      pii_email_ciphertext: encryptPii(email),
      pii_message_ciphertext: encryptPii(message),
      pii_email_hash: piiHash(normalizeEmailForHash(email)),
      pii_key_version: 1,
    })
    if (error) throw error
    return NextResponse.json({ ok: true }, { status: 201, headers })
  } catch (error) {
    console.error('contact-inquiry submission failed', error)
    return NextResponse.json({ error: 'We could not send your message. Please try again or use WhatsApp.' }, { status: 500, headers })
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('contact_inquiries').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const inquiries = (data || []).map(item => ({
    id: item.id, subject: item.subject, status: item.status, created_at: item.created_at, updated_at: item.updated_at, resolved_at: item.resolved_at,
    name: decryptPii(item.pii_name_ciphertext), email: decryptPii(item.pii_email_ciphertext), message: decryptPii(item.pii_message_ciphertext),
  }))
  return NextResponse.json({ inquiries })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => ({}))
  const id = cleanText(body.id, 100), status = cleanText(body.status, 30)
  if (!id || !['new', 'in_progress', 'resolved'].includes(status)) return NextResponse.json({ error: 'A valid enquiry and status are required.' }, { status: 400 })
  const { error } = await database().from('contact_inquiries').update({ status, updated_at: new Date().toISOString(), resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
