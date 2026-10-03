import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { decryptPii, revealLegacyPii } from '@/app/lib/pii-crypto'

type Row = Record<string, unknown>
type Prospect = { name: string; email: string; phone: string; sources: Set<string>; latest_at: string }

function readable(ciphertext: unknown, legacy: unknown): string {
  if (typeof ciphertext === 'string' && ciphertext) {
    try { return decryptPii(ciphertext).trim() } catch { /* use legacy value below */ }
  }
  return revealLegacyPii(legacy).trim()
}

function email(value: unknown) { return String(value || '').trim().toLowerCase() }
function phone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
}
function name(value: unknown) { return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase() }
function keys(person: { name: string; email: string; phone: string }) {
  return [person.email && `e:${person.email}`, person.phone && `p:${person.phone}`, person.name && `n:${person.name}`].filter(Boolean) as string[]
}

function isPurchase(order: Row) {
  const amount = Number(order.grand_total || order.total_amount || 0)
  const status = String(order.status || '').toLowerCase()
  const payment = String(order.payment_status || '').toLowerCase()
  const method = String(order.payment_method || '').toLowerCase()
  if (amount <= 0 || ['cancelled', 'returned', 'rto', 'failed'].includes(status)) return false
  return payment === 'paid' || method === 'cod' || ['confirmed', 'packed', 'labelled', 'dispatched', 'shipped', 'out_for_delivery', 'delivered'].includes(status)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [captureResult, cartResult, orderResult] = await Promise.all([
    db.from('email_captures').select('name,email,phone,source,created_at,pii_name_ciphertext,pii_email_ciphertext,pii_phone_ciphertext').order('created_at', { ascending: false }).limit(5000),
    db.from('abandoned_carts').select('customer_name,customer_email,customer_phone,abandoned_at,recovered,pii_name_ciphertext,pii_email_ciphertext,pii_phone_ciphertext').order('abandoned_at', { ascending: false }).limit(5000),
    db.from('orders').select('customer_name,customer_email,customer_phone,grand_total,total_amount,status,payment_status,payment_method,pii_name_ciphertext,pii_email_ciphertext,pii_phone_ciphertext').order('created_at', { ascending: false }).limit(5000),
  ])
  if (captureResult.error || cartResult.error || orderResult.error) return NextResponse.json({ error: 'Unable to build the prospect list.' }, { status: 500 })

  try {
    const buyerKeys = new Set<string>()
    for (const row of (orderResult.data || []) as Row[]) {
      if (!isPurchase(row)) continue
      const person = {
        name: name(readable(row.pii_name_ciphertext, row.customer_name)),
        email: email(readable(row.pii_email_ciphertext, row.customer_email)),
        phone: phone(readable(row.pii_phone_ciphertext, row.customer_phone)),
      }
      keys(person).forEach(key => buyerKeys.add(key))
    }

    const prospects = new Map<string, Prospect>()
    const add = (raw: { name: unknown; email: unknown; phone: unknown; source: string; created_at: unknown }) => {
      const person = { name: name(raw.name), email: email(raw.email), phone: phone(raw.phone) }
      // A number by itself is not a useful campaign record for this list. Keep
      // the requested name/email-led audience, while retaining phone when it is available.
      if (!person.name && !person.email) return
      const personKeys = keys(person)
      if (personKeys.some(key => buyerKeys.has(key))) return
      const knownKey = personKeys.find(key => prospects.has(key)) || personKeys[0]
      if (!knownKey) return
      const current = prospects.get(knownKey) || { name: '', email: '', phone: '', sources: new Set<string>(), latest_at: '' }
      current.name ||= person.name
      current.email ||= person.email
      current.phone ||= person.phone
      current.sources.add(raw.source)
      const capturedAt = String(raw.created_at || '')
      if (capturedAt > current.latest_at) current.latest_at = capturedAt
      personKeys.forEach(key => prospects.set(key, current))
    }

    for (const row of (captureResult.data || []) as Row[]) add({
      name: readable(row.pii_name_ciphertext, row.name), email: readable(row.pii_email_ciphertext, row.email), phone: readable(row.pii_phone_ciphertext, row.phone), source: 'Spin & leads', created_at: row.created_at,
    })
    for (const row of (cartResult.data || []) as Row[]) {
      if (row.recovered === true) continue
      add({
        name: readable(row.pii_name_ciphertext, row.customer_name), email: readable(row.pii_email_ciphertext, row.customer_email), phone: readable(row.pii_phone_ciphertext, row.customer_phone), source: 'Cart recovery', created_at: row.abandoned_at,
      })
    }

    const rows = [...new Set(prospects.values())]
      .map(prospect => ({ ...prospect, sources: [...prospect.sources].sort() }))
      .sort((left, right) => right.latest_at.localeCompare(left.latest_at))
    return NextResponse.json({ rows, count: rows.length })
  } catch (error) {
    console.error('[admin-prospects] unable to prepare records', error)
    return NextResponse.json({ error: 'Customer-data encryption is not configured correctly.' }, { status: 500 })
  }
}
