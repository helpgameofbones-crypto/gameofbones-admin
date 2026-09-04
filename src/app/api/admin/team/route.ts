import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

const permissions: Record<string, string[]> = {
  admin: ['dashboard', 'orders', 'products', 'customers', 'finance', 'analytics', 'campaigns', 'settings', 'team', 'production', 'inventory', 'returns', 'coupons', 'banners'],
  manager: ['dashboard', 'orders', 'products', 'customers', 'analytics', 'campaigns', 'inventory', 'returns', 'coupons', 'banners', 'production'],
  operations: ['dashboard', 'orders', 'inventory', 'returns', 'production'], viewer: ['dashboard', 'orders', 'analytics'],
}
function database() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const { data, error } = await database().from('team_members').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: 'Unable to load team members.' }, { status: 500 })
  return NextResponse.json({ team: data || [] })
}
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as { email?: unknown; name?: unknown; role?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : '', name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : '', role = typeof body?.role === 'string' ? body.role : ''
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name || !permissions[role]) return NextResponse.json({ error: 'Enter a valid name, email, and role.' }, { status: 400 })
  const { error } = await database().from('team_members').insert({ email, name, role, permissions: permissions[role], status: 'invited', invited_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'This email is already in the team.' : 'Unable to add team member.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown; role?: unknown; status?: unknown } | null
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'A team member is required.' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (typeof body.role === 'string' && permissions[body.role]) { update.role = body.role; update.permissions = permissions[body.role] }
  if (typeof body.status === 'string' && ['active', 'invited', 'suspended'].includes(body.status)) update.status = body.status
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No valid team update was supplied.' }, { status: 400 })
  const { error } = await database().from('team_members').update(update).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to update team member.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request); if (authError) return authError
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'A team member is required.' }, { status: 400 })
  const { error } = await database().from('team_members').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Unable to remove team member.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
