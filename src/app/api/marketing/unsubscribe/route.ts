import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyMarketingUnsubscribeToken } from '@/app/lib/marketing-unsubscribe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const page = (message: string, status = 200) => new NextResponse(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game of Bones email preferences</title></head><body style="margin:0;background:#f5f1e9;color:#173c2d;font-family:Arial,Helvetica,sans-serif"><main style="max-width:560px;margin:64px auto;padding:32px;background:#fff;border-radius:18px;text-align:center"><img src="https://gameofbones.in/assets/gob-logo.png" alt="Game of Bones" width="160" style="max-width:100%;height:auto"><h1 style="margin:28px 0 12px;font-size:28px">Email preferences updated</h1><p style="margin:0;line-height:1.6;color:#315246">${message}</p></main></body></html>`, {
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
})

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const payload = verifyMarketingUnsubscribeToken(token)
  if (!payload) return page('This email-preference link is invalid or has expired. Please contact us if you need help.', 400)

  try {
    const [leads, orders] = await Promise.all([
      supabase.from('email_captures').update({ marketing_consent: false, marketing_consent_at: null }).eq('pii_email_hash', payload.emailHash),
      supabase.from('orders').update({ marketing_consent: false, marketing_consent_at: null }).eq('pii_email_hash', payload.emailHash),
    ])
    if (leads.error) throw leads.error
    if (orders.error) throw orders.error
    return page('You will no longer receive Game of Bones marketing emails. You can still receive account, order and security updates.')
  } catch (error) {
    console.error('Marketing unsubscribe failed', error)
    return page('We could not update your preferences right now. Please try the link again later.', 500)
  }
}
