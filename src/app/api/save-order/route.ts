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
    
    console.log('Save order API received:', order)
    
    if (!order.ref || !order.customer_phone) {
      return NextResponse.json(
        { error: 'Missing required fields: ref, customer_phone' },
        { status: 400, headers: corsHeaders }
      )
    }
    
    const { error, data } = await supabase
      .from('orders')
      .insert([order])
      .select()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders }
      )
    }
    
    console.log('Order saved successfully:', data)
    
    // Send confirmation email
    if (order.customer_email) {
      fetch('https://gameofbones-admin.vercel.app/api/order-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      }).catch(e => console.log('Email send skipped:', e))
    }
    
    return NextResponse.json({ success: true, order: data }, { status: 201, headers: corsHeaders })
  } catch (e: any) {
    console.error('Save order error:', e)
    return NextResponse.json(
      { error: e.message },
      { status: 500, headers: corsHeaders }
    )
  }
}