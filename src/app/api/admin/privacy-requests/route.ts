import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cleanText } from '@/app/lib/public-request'
import { decryptPii } from '@/app/lib/pii-crypto'
import { requireAdmin } from '@/app/lib/requireAdmin'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const statuses = new Set(['received', 'in_review', 'verified', 'completed', 'declined'])

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await supabase.from('privacy_requests').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: (data || []).map(item => ({ ...item, email: decryptPii(item.pii_email_ciphertext), phone: decryptPii(item.pii_phone_ciphertext) })) })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => ({}))
  const id = cleanText(body.id, 100), status = cleanText(body.status, 30), ownerNote = cleanText(body.owner_note, 2000)
  if (!id || !statuses.has(status)) return NextResponse.json({ error: 'A valid request and status are required.' }, { status: 400 })
  const now = new Date().toISOString()
  const { error } = await supabase.from('privacy_requests').update({ status, owner_note: ownerNote || null, updated_at: now, completed_at: ['completed', 'declined'].includes(status) ? now : null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
