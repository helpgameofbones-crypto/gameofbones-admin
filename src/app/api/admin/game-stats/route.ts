import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/requireAdmin'

// Bone Run funnel for the Game Leads dashboard: players → winners → forms
// filled → rewards used on an order. ?days=7 limits to the last N days.
export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError
  const days = Math.floor(Number(request.nextUrl.searchParams.get('days') || 0))
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.rpc('game_lead_stats', { p_since: since })
  if (error) return NextResponse.json({ error: 'Unable to load game stats.' }, { status: 500 })
  return NextResponse.json({ stats: data })
}
