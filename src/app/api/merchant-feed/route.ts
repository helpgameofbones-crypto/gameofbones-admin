import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/* Google Merchant Center product feed (RSS 2.0 + g: namespace).
   Built live from the products table so prices and stock always match the website and checkout.
   One item per product, priced at its first (default) pack, which is what the product page shows first.
   Served publicly at https://gameofbones.in/google-merchant-feed.xml via a website rewrite. */

export const revalidate = 3600

const SITE = 'https://gameofbones.in'
const BRAND = 'Game of Bones'

const DESCRIPTIONS: Record<string, string> = {
  'chicken-jerky': '100% chicken breast, slow-dehydrated into thin, crunchy strips. Snaps into small pieces for training. Single ingredient, nothing added. Made in Kalyan, Maharashtra.',
  'chicken-bites': '100% chicken, slow-dehydrated into small ready-cut bites for training on the go. Single ingredient, nothing added.',
  'buff-jerky': '100% water buffalo meat, slow-dehydrated into firm jerky strips. A rich, single-protein treat for picky eaters and dogs that do better without chicken.',
  'chicken-feet': 'Whole chicken feet, slow-dehydrated until crunchy. A short chew with skin, cartilage and small bones. Single ingredient. Supervise while your dog chews.',
  'chicken-neck': 'Whole chicken necks, slow-dehydrated with the bone in. A meaty, crunchy chew for medium and large dogs. Single ingredient. Supervise while your dog chews.',
  'chicken-wings': 'Whole chicken wings, slow-dehydrated until crunchy. A meaty chew with bone for medium and large dogs. Single ingredient. Supervise while your dog chews.',
  'chicken-wing-tips': 'Chicken wing tips, slow-dehydrated into a light, crunchy chew with small bones. Single ingredient. Supervise while your dog chews.',
  'chicken-bones': 'Dehydrated chicken bone pieces for supervised chewing by medium and large dogs. Single ingredient, nothing added.',
  'goat-trachea': 'A whole goat windpipe, slow-dehydrated into a ridged, crunchy cartilage chew with no bone. Sold per piece. Single ingredient. Supervise while your dog chews.',
  'goat-trotter': 'Goat lower leg with skin, tendon and bone, slow-dehydrated into a hard, long-lasting chew for medium and large dogs. Sold per piece. Supervise while your dog chews.',
  'goat-ear': 'Goat ears, slow-dehydrated into a thin, crunchy chew suitable for most dogs. Single ingredient, nothing added.',
  'chicken-gizzards': '100% chicken gizzard, slow-dehydrated into firm, chewy pieces. A high-value single-ingredient reward.',
  'chicken-heart-and-liver': 'Chicken heart and liver, slow-dehydrated with nothing added. A rich, high-value reward to give in small pieces.',
  'goat-liver': '100% goat liver, slow-dehydrated into crisp pieces. A rich, high-value reward to give in small amounts.',
  'goat-lungs': '100% goat lung, slow-dehydrated into a light, airy treat that crumbles into small training pieces.',
  'goat-heart-and-kidney-mix': 'Goat heart and kidney, slow-dehydrated with nothing added. A rich organ treat to give in small pieces.',
  'goat-spleen': '100% goat spleen, slow-dehydrated into crisp pieces. A rich organ treat to give in small amounts.',
  'anchovies': 'Whole anchovies, slow-dehydrated with no salt or oil. A small, crunchy fish treat for dogs and cats.',
  'sardines': 'Whole sardines, slow-dehydrated with no salt or oil. A strong-smelling fish treat for picky dogs and cats.',
  'white-sardines': 'Whole white sardines, slow-dehydrated with no salt or oil. A crisp fish treat for dogs and cats.',
  'bombay-duck': 'Bombay duck (bombil) fish, slow-dehydrated into a light, crisp treat for dogs and cats. Single ingredient.',
  'tuna': '100% tuna, slow-dehydrated into firm, flaky pieces. A single-ingredient fish reward for dogs and cats.',
  'mackerel-fillet': 'Mackerel fillet, slow-dehydrated into firm pieces. A single-ingredient fish reward for dogs and cats.',
  'whole-mackerel': 'Whole mackerel, slow-dehydrated. A whole-fish chew with bones for medium and large dogs. Supervise while your dog eats.',
  'prawns': '100% prawns, slow-dehydrated into a crunchy treat. Single ingredient.',
  'whole-quail': 'Whole quail, slow-dehydrated with meat, bone and organs. A whole-prey chew for medium and large dogs. Supervise while your dog eats.',
  'cat-trial-box': 'A box of 5 single-ingredient fish treats for cats, to find out which ones your cat likes best.',
  'small-treat-box': 'A discovery box of 9 small packs of single-ingredient treats, to find your dog’s favourite.',
  'medium-treat-box': 'A box of 7 full packs of single-ingredient treats for a month of variety.',
  'large-treat-box': 'A box of 10 full packs of single-ingredient treats, for multi-dog homes or gifting.',
  'surprise-me-box': 'A surprise mix of single-ingredient dog treats, about 200 g in total.',
}

const DOG = 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Treats'
const CAT = 'Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Treats'

const slug = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const xml = (value: unknown) => String(value ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
const absolute = (url: string) => /^https?:\/\//.test(url) ? url : `${SITE}/${url.replace(/^\/+/, '')}`

type Pack = { label?: unknown; price?: unknown; weight_grams?: unknown }

export async function GET() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db.from('products').select('name,price,category,stock,image_url,images,sizes,is_active,weight_grams').eq('is_active', true).order('name')
  if (error) return new NextResponse('Feed temporarily unavailable', { status: 503 })

  const items = (data || []).map(product => {
    const id = slug(String(product.name || ''))
    const packs: Pack[] = Array.isArray(product.sizes) ? product.sizes.filter((p: Pack) => p && !/^trial\b/i.test(String(p.label || ''))) : []
    const first = packs[0]
    const price = Number(first?.price ?? product.price) || 0
    if (!id || !price) return ''
    const images = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter((u): u is string => typeof u === 'string' && !!u)
    const unique = [...new Set(images.map(absolute))]
    const stock = product.stock === null || product.stock === undefined ? 1 : Number(product.stock)
    const label = String(first?.label || '').trim()
    const isBox = /box/i.test(String(product.category || '')) || /box/i.test(String(product.name || ''))
    const isCat = /cat/i.test(String(product.name || ''))
    const title = `${product.name} – Single-Ingredient ${isCat ? 'Cat' : 'Dog'} ${isBox ? 'Treat Box' : 'Treat'}${label && !/pack of 1/i.test(label) ? `, ${label}` : ''}`
    const description = DESCRIPTIONS[id] || `${product.name}: single-ingredient, slow-dehydrated pet treat made in Kalyan, Maharashtra.`
    const grams = Number(first?.weight_grams) || Number(product.weight_grams) || 0
    return `<item>
<g:id>${xml(id)}</g:id>
<g:title>${xml(title.slice(0, 150))}</g:title>
<g:description>${xml(description)}</g:description>
<g:link>${xml(`${SITE}/products/${id}`)}</g:link>
${unique[0] ? `<g:image_link>${xml(unique[0])}</g:image_link>` : ''}
${unique.slice(1, 6).map(u => `<g:additional_image_link>${xml(u)}</g:additional_image_link>`).join('\n')}
<g:availability>${stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${price.toFixed(2)} INR</g:price>
<g:brand>${BRAND}</g:brand>
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
<g:google_product_category>${xml(isCat ? CAT : DOG)}</g:google_product_category>
<g:product_type>${xml(String(product.category || 'Treats'))}</g:product_type>
${grams > 0 ? `<g:product_weight>${grams} g</g:product_weight>` : ''}
<g:shipping><g:country>IN</g:country><g:service>Standard</g:service><g:price>0.00 INR</g:price></g:shipping>
</item>`
  }).filter(Boolean)

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Game of Bones – single-ingredient dog and cat treats</title>
<link>${SITE}</link>
<description>Slow-dehydrated single-ingredient treats made in Kalyan, Maharashtra.</description>
${items.join('\n')}
</channel>
</rss>`
  return new NextResponse(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
