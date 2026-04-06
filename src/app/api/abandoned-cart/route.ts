import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Called from website when phone is entered at checkout but order not placed
export async function POST(req: NextRequest) {
  try {
    const { phone, email, name, items, total } = await req.json()
    if (!phone || !items?.length) {
      return NextResponse.json({ ok: true }, { headers: corsHeaders })
    }

    // Save abandoned cart to Supabase
    await supabase.from('abandoned_carts').upsert({
      customer_phone: phone,
      customer_email: email || null,
      customer_name: name || null,
      items,
      total,
      abandoned_at: new Date().toISOString(),
      recovered: false,
    }, { onConflict: 'customer_phone' })

    return NextResponse.json({ ok: true }, { headers: corsHeaders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders })
  }
}
