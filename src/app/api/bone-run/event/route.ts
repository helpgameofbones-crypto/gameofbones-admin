import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

/**
 * Anonymous Bone Run play tracking (game start / game end + score) for the
 * Game Leads dashboard. Stores no personal data: only a random per-device id.
 */
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const tierFor = (score: number) => (score >= 20000 ? 4 : score >= 5000 ? 3 : score >= 2500 ? 2 : score >= 800 ? 1 : 0)

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = await rateLimit(req, 'bone-run-event', 300, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json().catch(() => ({}))
    const playerId = String(body.player_id || '')
    const event = String(body.event || '')
    if (!/^[a-z0-9-]{8,64}$/i.test(playerId) || !['start', 'end'].includes(event)) {
      return NextResponse.json({ ok: false }, { status: 400, headers })
    }
    const score = event === 'end' ? Math.max(0, Math.min(20000, Math.floor(Number(body.score) || 0))) : null
    const { error } = await supabase.from('game_events').insert({ game: 'bone_run', player_id: playerId, event, score, tier: score === null ? null : tierFor(score) })
    if (error) throw error
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) {
    console.error('[bone-run/event] failed', error)
    return NextResponse.json({ ok: false }, { status: 500, headers })
  }
}
