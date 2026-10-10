import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const money = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 1_000_000) : 0
}

const mediaList = (value: unknown, limit: number) => Array.isArray(value)
  ? value.filter(item => typeof item === 'string' && item.length <= 2000).slice(0, limit)
  : []

const packList = (value: unknown) => Array.isArray(value)
  ? value.slice(0, 20).map((entry) => {
    const pack = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
    return {
      label: cleanText(pack.label, 100),
      price: money(pack.price),
      compare_price: money(pack.compare_price),
      weight_grams: money(pack.weight_grams),
    }
  }).filter(pack => pack.label)
  : []

const LOW_STOCK_THRESHOLD = 10
// Products without a stock number stay sellable (older records / bundles).
const stockSignal = (value: unknown) => {
  if (value === null || value === undefined || value === '') return { in_stock: true, stock_left: null }
  const count = Math.max(0, Math.floor(Number(value) || 0))
  return { in_stock: count > 0, stock_left: count <= LOW_STOCK_THRESHOLD ? count : null }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

// This is intentionally separate from the administrator route. It is a
// read-only, storefront-safe catalogue that contains no cost or supplier
// information. Inventory is reduced to an in-stock flag plus the exact count
// only when 10 or fewer pouches remain (for "Only N left" badges). The admin product editor remains the source of truth.
export async function GET(request: NextRequest) {
  const originError = rejectUnexpectedOrigin(request)
  if (originError) return originError

  const limited = await rateLimit(request, 'public-products', 120, 60_000)
  if (limited) return limited

  const client = database()
  let { data, error }: { data: Array<Record<string, any>> | null; error: any } = await client
    .from('products')
    .select('id,name,image_url,images,videos,price,compare_price,sizes,is_active,is_bestseller,stock')
    .order('name')
    .limit(2000)

  // Keep the storefront usable during a staggered schema rollout. Older
  // production databases may not have optional media/bestseller columns yet.
  if (error) {
    const fallback = await client
      .from('products')
      .select('id,name,image_url,images,price,compare_price,sizes,is_active,stock')
      .order('name')
      .limit(2000)
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: 'Unable to load the catalogue.' }, { status: 500, headers: corsHeaders(request) })

  const products = (data || []).map(product => {
    const images = mediaList(product.images, 6)
    const videos = mediaList(product.videos, 3)
    const sizes = packList(product.sizes)
    return {
      id: cleanText(product.id, 100),
      name: cleanText(product.name, 300),
      image_url: images[0] || cleanText(product.image_url, 2000),
      images,
      videos,
      price: money(product.price),
      compare_price: money(product.compare_price),
      is_active: Boolean(product.is_active),
      sizes,
      is_bestseller: Boolean(product.is_bestseller),
      ...stockSignal(product.stock),
    }
  }).filter(product => product.id && product.name)

  return NextResponse.json({ products }, {
    headers: {
      ...corsHeaders(request),
      // A brief CDN cache protects the Supabase free tier while making edits
      // visible on the storefront within about one minute.
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=60',
    },
  })
}
