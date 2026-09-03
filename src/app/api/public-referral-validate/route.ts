import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CODE_RE = /^[A-Z0-9-]{4,40}$/

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'public-referral-validate', 10, 60 * 60 * 1000); if (limitError) return limitError
    const code = cleanText((await req.json()).code, 40).toUpperCase()
    if (!CODE_RE.test(code)) return NextResponse.json({ valid: false }, { headers })
    const { data, error } = await supabase.from('customers').select('id').eq('referral_code', code).limit(1)
    if (error) throw error
    return NextResponse.json({ valid: Boolean(data?.length) }, { headers })
  } catch {
    return NextResponse.json({ error: 'Unable to validate referral code' }, { status: 500, headers })
  }
}
