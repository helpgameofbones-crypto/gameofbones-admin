import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cleanText, rateLimit } from '@/app/lib/public-request'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const cacheHeaders = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' }
function displayName(name: unknown) {
  const parts = cleanText(name, 100).split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Verified dog parent'
  const visibleName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
  return `${visibleName} · verified dog parent`
}

// Homepage "Dogs of Game of Bones": latest published reviews that include a customer's own photo.
async function communityPhotos(request: NextRequest) {
  const limited = await rateLimit(request, 'public-product-reviews', 120, 60 * 60 * 1000); if (limited) return limited
  try {
    const result = await db.from('product_reviews').select('customer_name,product_name,rating,review,photo_path,created_at').eq('status', 'published').not('photo_path', 'is', null).order('created_at', { ascending: false }).limit(12)
    if (result.error) throw result.error
    const photos = (await Promise.all((result.data || []).map(async row => {
      const signed = await db.storage.from('review-photos').createSignedUrl(String(row.photo_path), 60 * 60 * 6)
      const photo_url = signed.data?.signedUrl || ''
      return photo_url ? { name: displayName(row.customer_name), product: cleanText(row.product_name, 120), rating: Number(row.rating), review: cleanText(row.review, 240), photo_url, created_at: row.created_at } : null
    }))).filter(Boolean)
    return NextResponse.json({ photos }, { headers: cacheHeaders })
  } catch (error) { console.error('Community photos failed', error); return NextResponse.json({ photos: [] }, { status: 200, headers: cacheHeaders }) }
}

export async function GET(request: NextRequest) {
  const product = cleanText(request.nextUrl.searchParams.get('product'), 140)
  if (!product && request.nextUrl.searchParams.get('photos') === '1') return communityPhotos(request)
  if (!product) return NextResponse.json({ error: 'Choose a product.' }, { status: 400, headers: cacheHeaders })
  const limited = await rateLimit(request, 'public-product-reviews', 120, 60 * 60 * 1000); if (limited) return limited
  try {
    const productResult = await db.from('products').select('id').ilike('name', product).maybeSingle()
    if (productResult.error || !productResult.data) return NextResponse.json({ reviews: [], average_rating: null, review_count: 0 }, { headers: cacheHeaders })
    const reviewsResult = await db.from('product_reviews').select('customer_name,rating,review,photo_path,created_at').eq('product_id', productResult.data.id).eq('status', 'published').order('created_at', { ascending: false }).limit(20)
    if (reviewsResult.error) throw reviewsResult.error
    const reviews = await Promise.all((reviewsResult.data || []).map(async row => {
      let photo_url = ''
      if (row.photo_path) { const signed = await db.storage.from('review-photos').createSignedUrl(row.photo_path, 60 * 60); photo_url = signed.data?.signedUrl || '' }
      return { name: displayName(row.customer_name), rating: Number(row.rating), review: cleanText(row.review, 1500), photo_url, created_at: row.created_at }
    }))
    const average = reviews.length ? Math.round((reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length) * 10) / 10 : null
    return NextResponse.json({ reviews, average_rating: average, review_count: reviews.length }, { headers: cacheHeaders })
  } catch (error) { console.error('Public product reviews failed', error); return NextResponse.json({ error: 'Unable to load product reviews.' }, { status: 500, headers: cacheHeaders }) }
}
