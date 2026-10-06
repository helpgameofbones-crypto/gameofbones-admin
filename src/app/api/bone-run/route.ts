import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto'
import { sendWheelWelcomeEmail } from '@/app/lib/lifecycle-emails'
import { BONE_RUN_MAX_SCORE, SPIN_GIFT_MIN_ORDER, SPIN_GIFT_VALID_DAYS, boneRunTierForScore, giftForLabel } from '@/app/lib/spin-gifts'

/**
 * Bone Run prize claims. The game runs in the browser, so the score is
 * untrusted: the prize tier is always derived here from the score, and the
 * score must be physically possible for the reported run time. Each customer
 * (matched by hashed phone or email) holds at most one gift. A better run
 * upgrades an unused gift; a gift that was already used on an order is final.
 */
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const couponCodeFor = () => `RUN${randomBytes(5).toString('hex').toUpperCase()}`
// Fastest possible scoring in the game is ~84 points/s from distance plus
// ~22 points/s from bones. Anything quicker than this was not really played.
const MAX_POINTS_PER_SECOND = 115
const MAX_RUN_MS = 30 * 60 * 1000

type Coupon = { id: string; code: string; uses_count: number | null; max_uses: number | null; is_active: boolean | null; valid_until: string | null }

export async function OPTIONS(req: NextRequest) { return NextResponse.json({}, { headers: corsHeaders(req) }) }

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  try {
    const originError = rejectUnexpectedOrigin(req); if (originError) return originError
    const limitError = await rateLimit(req, 'bone-run', 8, 60 * 60 * 1000); if (limitError) return limitError
    const body = await req.json()
    const name = cleanText(body.name, 100), email = normalizeEmailForHash(cleanText(body.email, 254)), phone = normalizePhoneForHash(cleanText(body.phone, 20))
    if (!name || !emailPattern.test(email) || !/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a name, valid email, and 10-digit mobile number.' }, { status: 400, headers })
    // Claims made from the game ask for email consent. A prize that is applied
    // automatically during checkout is part of the order, so it needs no
    // marketing consent and sends no separate email.
    const viaCheckout = body.via === 'checkout'
    const consent = body.marketing_consent === true
    if (!viaCheckout && !consent) return NextResponse.json({ error: 'Please agree to receive your free treat details by email.' }, { status: 400, headers })

    const score = Math.floor(Number(body.score))
    const runMs = Math.floor(Number(body.run_ms))
    if (!Number.isFinite(score) || score < 0 || score > BONE_RUN_MAX_SCORE || !Number.isFinite(runMs) || runMs <= 0 || runMs > MAX_RUN_MS) {
      return NextResponse.json({ error: 'That run could not be verified. Please play again.' }, { status: 400, headers })
    }
    if (score / (runMs / 1000) > MAX_POINTS_PER_SECOND) {
      return NextResponse.json({ error: 'That run could not be verified. Please play again.' }, { status: 400, headers })
    }
    const tier = boneRunTierForScore(score)
    if (!tier) return NextResponse.json({ error: 'Reach 800 points to unlock a free treat.' }, { status: 400, headers })

    const emailHash = piiHash(email), phoneHash = piiHash(phone)
    const prior = await supabase.from('email_captures')
      .select('id,prize,coupon_code,source')
      .in('source', ['spin_to_win', 'bone_run'])
      .or(`pii_phone_hash.eq.${phoneHash},pii_email_hash.eq.${emailHash}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (prior.error) throw prior.error

    const today = new Date().toISOString().slice(0, 10)
    const expires = new Date(Date.now() + SPIN_GIFT_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const sendEmail = async (couponCode: string, prize: string, captureId: string) => {
      if (viaCheckout) return
      try {
        await sendWheelWelcomeEmail({ name, email, couponCode, prize, gift: true, game: 'bone_run', score })
        await supabase.from('email_captures').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', captureId)
      } catch (emailError) {
        // A prize must never be lost because the mail provider is unavailable.
        console.error('Bone Run prize email failed', emailError)
      }
    }

    if (prior.data?.coupon_code) {
      const { data: coupon } = await supabase.from('coupons')
        .select('id,code,uses_count,max_uses,is_active,valid_until').eq('code', prior.data.coupon_code).maybeSingle<Coupon>()
      const used = coupon && Number(coupon.uses_count || 0) >= Number(coupon.max_uses || 1)
      if (used) {
        return NextResponse.json({ status: 'already_used', prize: prior.data.prize || 'your free treat' }, { headers })
      }
      const current = giftForLabel(prior.data.prize)
      const expired = !coupon || coupon.is_active !== true || (coupon.valid_until && String(coupon.valid_until).slice(0, 10) < today)
      if (coupon && !expired && current && current.rank >= tier.rank) {
        return NextResponse.json({ status: 'kept', prize: prior.data.prize, coupon_code: coupon.code, min_order: SPIN_GIFT_MIN_ORDER, valid_until: coupon.valid_until }, { headers })
      }
      if (coupon) {
        // Upgrade (or renew an expired, never-used gift) in place: same code.
        const { error: couponError } = await supabase.from('coupons').update({ is_active: true, valid_from: today, valid_until: expires, min_order: SPIN_GIFT_MIN_ORDER }).eq('id', coupon.id).eq('uses_count', 0)
        if (couponError) throw couponError
        const { error: captureError } = await supabase.from('email_captures').update({ prize: tier.label, source: 'bone_run' }).eq('id', prior.data.id)
        if (captureError) throw captureError
        await sendEmail(coupon.code, tier.label, prior.data.id)
        return NextResponse.json({ status: current && current.rank < tier.rank ? 'upgraded' : 'renewed', prize: tier.label, coupon_code: coupon.code, min_order: SPIN_GIFT_MIN_ORDER, valid_until: expires }, { headers })
      }
    }

    const couponCode = couponCodeFor()
    const couponInsert = await supabase.from('coupons').insert({ code: couponCode, type: 'free', value: 0, min_order: SPIN_GIFT_MIN_ORDER, max_uses: 1, uses_count: 0, valid_from: today, valid_until: expires, is_active: true })
    if (couponInsert.error) throw couponInsert.error
    const insert = await supabase.from('email_captures').insert({ source: 'bone_run', status: 'active', prize: tier.label, coupon_code: couponCode, marketing_consent: consent, marketing_consent_at: consent ? new Date().toISOString() : null, pii_email_ciphertext: encryptPii(email), pii_name_ciphertext: encryptPii(name), pii_phone_ciphertext: encryptPii(phone), pii_email_hash: emailHash, pii_phone_hash: phoneHash, pii_key_version: 1 }).select('id').single()
    if (insert.error) throw insert.error
    await sendEmail(couponCode, tier.label, insert.data.id)
    return NextResponse.json({ status: 'created', prize: tier.label, coupon_code: couponCode, min_order: SPIN_GIFT_MIN_ORDER, valid_until: expires }, { status: 201, headers })
  } catch (error) {
    console.error('[bone-run] claim failed', error)
    return NextResponse.json({ error: 'Unable to save your prize right now. Please try again.' }, { status: 500, headers })
  }
}
