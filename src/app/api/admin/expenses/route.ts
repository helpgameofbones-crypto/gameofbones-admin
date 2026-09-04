import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const params = request.nextUrl.searchParams
  const days = Math.min(Math.max(Number(params.get('days')) || 30, 1), 365)
  const person = params.get('person') || 'all'
  const from = new Date(); from.setDate(from.getDate() - days)
  let query = database().from('expenses').select('*').gte('date', from.toISOString().slice(0, 10)).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
  if (person !== 'all') query = query.eq('person', person)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load expenses.' }, { status: 500 })
  return NextResponse.json({ expenses: data || [] })
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ''
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : ''
  const amount = Number(body?.amount)
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 100) : 'Miscellaneous'
  const person = typeof body?.person === 'string' ? body.person.trim().slice(0, 100) : ''
  const paymentMode = typeof body?.payment_mode === 'string' ? body.payment_mode.trim().slice(0, 100) : 'cash'
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''
  if (!date || !description || !person || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return NextResponse.json({ error: 'Please provide a valid expense.' }, { status: 400 })
  const db = database()
  const { error } = await db.from('expenses').insert({ date, description, amount, category, person, payment_mode: paymentMode, notes })
  if (error) return NextResponse.json({ error: 'Unable to add expense.' }, { status: 500 })
  await db.from('activity_log').insert({ action: 'expense added', entity_type: 'expense', entity_name: description, details: `Rs ${amount} by ${person}` })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const id = request.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'Expense id is required.' }, { status: 400 })
  const { error } = await database().from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete expense.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
