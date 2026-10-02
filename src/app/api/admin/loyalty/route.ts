import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'
import { decryptPii, normalizePhoneForHash, revealLegacyPii } from '@/app/lib/pii-crypto'

function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

function readable(ciphertext: unknown, legacy: unknown): string {
  if (typeof ciphertext === 'string' && ciphertext) return decryptPii(ciphertext)
  return revealLegacyPii(legacy)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const customerId = request.nextUrl.searchParams.get('customerId')
  if (customerId) {
    const db = database()
    const { data: customer, error: customerError } = await db.from('customers').select('id,phone,pii_phone_ciphertext').eq('id', customerId).maybeSingle()
    if (customerError || !customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    const phone = normalizePhoneForHash(readable(customer.pii_phone_ciphertext, customer.phone))
    const [ledgerResult, reviewRewardsResult] = await Promise.all([
      db.from('loyalty_ledger').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(500),
      phone ? db.from('rewards').select('id,type,description,discount_value,created_at,expires_at').eq('customer_phone', phone).eq('type', 'review').order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    ])
    if (ledgerResult.error || reviewRewardsResult.error) return NextResponse.json({ error: 'Unable to load loyalty history.' }, { status: 500 })
    const ledger = ledgerResult.data || []
    // A handful of previously approved reviews credited the balance and reward
    // record but missed their optional ledger insert. Surface those points in
    // history without duplicating newer reviews that have both records.
    const reviewRows = (reviewRewardsResult.data || []).filter(reward => !ledger.some(entry => {
      if (entry.type !== 'review' || Number(entry.points || 0) !== Number(reward.discount_value || 0)) return false
      return Math.abs(new Date(entry.created_at).getTime() - new Date(reward.created_at).getTime()) < 60_000
    })).map(reward => ({
      id: `review-${reward.id}`,
      type: 'review',
      points: Number(reward.discount_value || 0),
      balance_after: null,
      order_ref: null,
      description: reward.description || 'Points for an approved review',
      created_at: reward.created_at,
      expires_at: reward.expires_at,
    }))
    return NextResponse.json({ ledger: [...ledger, ...reviewRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) })
  }
  const { data, error } = await database().from('customers').select('*').order('loyalty_points', { ascending: false }).limit(5000)
  if (error) return NextResponse.json({ error: 'Unable to load customers.' }, { status: 500 })
  // The loyalty dashboard is an authenticated admin view, so return readable
  // customer contact values while never exposing the encrypted source columns.
  const customers = (data || []).map(customer => ({
    ...customer,
    name: readable(customer.pii_name_ciphertext, customer.name),
    phone: readable(customer.pii_phone_ciphertext, customer.phone),
    email: readable(customer.pii_email_ciphertext, customer.email),
    pii_name_ciphertext: undefined,
    pii_phone_ciphertext: undefined,
    pii_email_ciphertext: undefined,
    pii_name_hash: undefined,
    pii_phone_hash: undefined,
    pii_email_hash: undefined,
  }))
  return NextResponse.json({ customers })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown; profile?: unknown; points?: unknown; reason?: unknown; phone?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.action !== 'string') return NextResponse.json({ error: 'A customer and action are required.' }, { status: 400 })
  const db = database()
  if (body.action === 'profile') {
    const profile = body.profile as Record<string, unknown> | null
    if (!profile || typeof profile !== 'object') return NextResponse.json({ error: 'A dog profile is required.' }, { status: 400 })
    const update: Record<string, string> = {}
    for (const key of ['dog_name', 'dog_breed', 'dog_age', 'dog_weight', 'dog_preferences']) if (typeof profile[key] === 'string') update[key] = profile[key].slice(0, 500)
    const { error } = await db.from('customers').update(update).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to save dog profile.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'points') {
    const points = Number(body.points)
    if (!Number.isInteger(points) || points < 1 || points > 10000) return NextResponse.json({ error: 'Points must be a whole number between 1 and 10,000.' }, { status: 400 })
    const { data: customer, error: customerError } = await db.from('customers').select('name,loyalty_points').eq('id', body.id).maybeSingle()
    if (customerError || !customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    const newBalance = Number(customer.loyalty_points || 0) + points
    const expiresAt = new Date(Date.now() + 60 * 86400000).toISOString()
    const { error } = await db.from('customers').update({ loyalty_points: newBalance, loyalty_points_expire_at: expiresAt }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to update points.' }, { status: 500 })
    await db.from('loyalty_ledger').insert({ customer_id: body.id, customer_name: customer.name || '', type: 'manual_credit', points, balance_after: newBalance, description: typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'Manual loyalty credit' })
    await db.from('activity_log').insert({ action: 'loyalty points added', entity_type: 'customer', entity_id: body.id, entity_name: customer.name || '', details: `+${points} points` })
    return NextResponse.json({ ok: true, loyalty_points: newBalance, loyalty_points_expire_at: expiresAt })
  }
  if (body.action === 'referral') {
    if (typeof body.phone !== 'string') return NextResponse.json({ error: 'A customer phone is required.' }, { status: 400 })
    const code = `GOB${body.phone.replace(/\D/g, '').slice(-4)}${Math.random().toString(36).slice(-3).toUpperCase()}`
    const { error } = await db.from('customers').update({ referral_code: code }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Unable to generate referral code.' }, { status: 500 })
    return NextResponse.json({ ok: true, referral_code: code })
  }
  return NextResponse.json({ error: 'Unsupported loyalty action.' }, { status: 400 })
}
