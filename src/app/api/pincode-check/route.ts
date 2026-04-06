import { NextRequest, NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pin = searchParams.get('pin')
  if (!pin || pin.length !== 6) return NextResponse.json({ serviceable: true }, { headers: corsHeaders })
  try {
    const token = process.env.DELHIVERY_API_TOKEN
    if (!token) return NextResponse.json({ serviceable: true }, { headers: corsHeaders })
    const res = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pin}`, {
      headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    const pinData = data?.delivery_codes?.[0]?.postal_code
    const serviceable = pinData?.pre_paid === 'Y' || pinData?.cod === 'Y'
    return NextResponse.json({ serviceable: serviceable ?? true, city: pinData?.city || '', state: pinData?.state_code || '' }, { headers: corsHeaders })
  } catch {
    return NextResponse.json({ serviceable: true }, { headers: corsHeaders })
  }
}