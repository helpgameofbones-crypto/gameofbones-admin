import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

function deliveryEstimate(state: string) {
  if (state === 'MH') return '2–4 business days after dispatch'
  if (['GJ', 'GA', 'KA', 'MP', 'RJ', 'TG'].includes(state)) return '3–5 business days after dispatch'
  return '4–7 business days after dispatch'
}

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = rateLimit(req, 'pincode-check', 30, 60 * 60 * 1000); if (limitError) return limitError
    const pin = new URL(req.url).searchParams.get('pin') || ''
    if (!/^[1-9]\d{5}$/.test(pin)) return NextResponse.json({ error: 'Enter a valid six-digit Indian PIN code.' }, { status: 400, headers })
    const token = process.env.DELHIVERY_API_TOKEN
    if (!token) return NextResponse.json({ error: 'Live Delhivery delivery lookup is not configured yet.' }, { status: 503, headers })
    const response = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`, { headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' })
    if (!response.ok) throw new Error('Delhivery did not accept the lookup')
    const data = await response.json()
    const postal = data?.delivery_codes?.[0]?.postal_code
    if (!postal) return NextResponse.json({ serviceable: false, source: 'delhivery' }, { headers })
    const prepaid = postal.pre_paid === 'Y', cod = postal.cod === 'Y'
    const serviceable = prepaid || cod, state = String(postal.state_code || '').toUpperCase()
    return NextResponse.json({ serviceable, prepaid, cod, city: postal.city || '', state, dispatch: 'Dispatches in 1–2 working days', eta: serviceable ? deliveryEstimate(state) : '', source: 'delhivery' }, { headers })
  } catch {
    return NextResponse.json({ error: 'Live Delhivery delivery lookup is temporarily unavailable.' }, { status: 503, headers })
  }
}
