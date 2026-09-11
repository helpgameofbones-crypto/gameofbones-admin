import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

type CartItem = {
  name?: unknown
  sizeLabel?: unknown
  size?: unknown
  qty?: unknown
  quantity?: unknown
  price?: unknown
}

type ProductImageRow = {
  name: string
  image_url?: unknown
  images?: unknown
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function escapeHtml(value: unknown): string {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function catalogueImage(row: ProductImageRow): string {
  const candidates = [
    ...(Array.isArray(row.images) ? row.images : []),
    row.image_url,
  ]

  return candidates
    .map((value) => text(value))
    .find((value) => /^https:\/\//i.test(value)) || ''
}

async function productImagesFor(items: CartItem[]): Promise<Map<string, string>> {
  const names = [...new Set(items.map((item) => text(item.name)).filter(Boolean))].slice(0, 25)
  if (!names.length) return new Map()

  const { data, error } = await supabase
    .from('products')
    .select('name,image_url,images')
    .in('name', names)

  if (error || !data) return new Map()

  return new Map(
    (data as ProductImageRow[])
      .map((product) => [text(product.name), catalogueImage(product)] as const)
      .filter(([, image]) => Boolean(image))
  )
}

// Cron job: originally ran every hour and swept a tight 1-2h window, but
// Vercel's Hobby plan only allows crons to run once per day (anything more
// frequent fails at deploy time -- see vercel.json). Now runs once daily and
// sweeps a full rolling ~25h window instead, so a cart abandoned at any point
// since the previous run still gets caught. The old hourly version relied on
// each cart falling into its narrow window exactly once as the *only* guard
// against duplicate emails; that's no longer safe with a wider window (a
// cart sitting abandoned for several days would otherwise re-match every
// day), so this also checks/sets followup_sent_at as an explicit dedup flag.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const windowStart = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25h ago
  const oneHourAgo  = new Date(Date.now() - 1 * 60 * 60 * 1000)  // still give an
    // active shopper at least 1h before following up, same buffer as before

  const { data: carts } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('recovered', false)
    .is('followup_sent_at', null)
    .not('customer_email', 'is', null)
    .gte('abandoned_at', windowStart.toISOString())
    .lt('abandoned_at', oneHourAgo.toISOString())

  let sent = 0
  for (const cart of carts || []) {
    const items = Array.isArray(cart.items) ? cart.items as CartItem[] : []
    // Resolve images from the current, admin-managed catalogue. Cart payloads
    // can be old or user-controlled, so we never render their image URL.
    const productImages = await productImagesFor(items)
    const itemsHtml = items.map((item) => {
      const name = text(item.name) || 'Treat'
      const pack = text(item.sizeLabel ?? item.size)
      const quantity = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1)
      const price = Math.max(0, Number(item.price) || 0)
      const image = productImages.get(name) || ''
      const imageCell = image
        ? `<td width="68" valign="middle" style="width:68px;padding:10px 12px 10px 0"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #eee6d8" /></td>`
        : ''
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f0ebe3"><tr>${imageCell}<td valign="middle" style="padding:10px 0;font-size:13px;line-height:1.45;color:#1a1008"><strong>${escapeHtml(name)}</strong>${pack ? ` · ${escapeHtml(pack)}` : ''} × ${quantity}</td><td valign="middle" align="right" style="padding:10px 0;font-size:13px;font-weight:600;color:#1a1008;white-space:nowrap">₹${(price * quantity).toLocaleString('en-IN')}</td></tr></table>`
    }).join('')
    const couponCode = text(cart.coupon_code) || 'SAVE50'
    const couponLabel = cart.coupon_code ? '10% off' : '₹50 off'
    const firstName = escapeHtml(text(cart.customer_name).split(' ')[0] || 'there')
    const total = Math.max(0, Number(cart.total) || 0).toLocaleString('en-IN')
    const recoveryUrl = `https://gameofbones.in/?cart=recover&phone=${encodeURIComponent(text(cart.customer_phone))}`
    const html = lifecycleEmailTemplate({
      eyebrow: 'Your treats are waiting',
      title: 'Your pup’s treats are still in the bowl.',
      introHtml: `Hi ${firstName}, you left these treats in your cart. We’ve saved them for you.`,
      detailHtml: `${emailCard(`${itemsHtml}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:14px;font-size:15px;font-weight:700">TOTAL</td><td align="right" style="padding-top:14px;font-size:17px;font-weight:700">₹${total}</td></tr></table>`, 'left')}<div style="margin-top:13px;background:#fff4cb;border:1px solid #dfb75e;border-radius:9px;padding:12px 15px;font-size:13px;line-height:1.45">Use code <strong>${escapeHtml(couponCode)}</strong> for ${couponLabel} if you complete your order in the next 24 hours.</div>`,
      ctaLabel: 'Complete my order',
      ctaUrl: recoveryUrl,
    })

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: cart.customer_email,
      subject: `${cart.customer_name?.split(' ')[0] || 'Hey'}, your dog treats are waiting! 🐾`,
      html,
    })

    // Mark sent immediately so a second cron run (retry, or the query
    // matching the same row twice due to clock drift) never double-emails.
    await supabase
      .from('abandoned_carts')
      .update({ followup_sent_at: new Date().toISOString() })
      .eq('id', cart.id)

    sent++
  }

  return NextResponse.json({ sent })
}
