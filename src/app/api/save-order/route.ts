import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  try {
    const order = await req.json()
    
    const { error, data } = await supabase
      .from('orders')
      .insert([order])
      .select()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders })
    }
    
    return NextResponse.json({ success: true, order: data }, { status: 201, headers: corsHeaders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders })
  }
}