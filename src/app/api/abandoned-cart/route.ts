import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '@/app/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const { phone, email, name, items, total } = await req.json()
    if (!phone || !items?.length) {
      return NextResponse.json({ ok: true }, { headers })
    }
    await supabase.from('abandoned_carts').upsert({
      customer_phone: phone,
      customer_email: email || null,
      customer_name: name || null,
      items, total,
      abandoned_at: new Date().toISOString(),
      recovered: false,
    }, { onConflict: 'customer_phone' })

    return NextResponse.json({ ok: true }, { headers })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers })
  }
}
