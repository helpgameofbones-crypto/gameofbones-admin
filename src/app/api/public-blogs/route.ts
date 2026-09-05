import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/app/lib/cors'
import { cleanText, rateLimit, rejectUnexpectedOrigin } from '@/app/lib/public-request'

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const cleanUrl = (value: unknown) => {
  const url = cleanText(value, 2000)
  return /^https:\/\//i.test(url) ? url : ''
}

const cleanTags = (value: unknown) => Array.isArray(value)
  ? value.filter(tag => typeof tag === 'string').map(tag => cleanText(tag, 50)).filter(Boolean).slice(0, 20)
  : []

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

// Read-only feed for the public journal. It deliberately exposes only
// published editorial fields, never author/admin or internal content data.
export async function GET(request: NextRequest) {
  const originError = rejectUnexpectedOrigin(request)
  if (originError) return originError

  const limited = rateLimit(request, 'public-blogs', 60, 60_000)
  if (limited) return limited

  const { data, error } = await database()
    .from('blogs')
    .select('id,title,slug,category,excerpt,body,cover_image,read_time,tags,created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Unable to load the journal.' }, { status: 500, headers: corsHeaders(request) })

  const blogs = (data || []).map(blog => ({
    id: cleanText(blog.id, 100),
    title: cleanText(blog.title, 300),
    slug: cleanText(blog.slug, 300).replace(/[^a-z0-9-]/g, ''),
    category: cleanText(blog.category, 100) || 'Guide',
    excerpt: cleanText(blog.excerpt, 1000),
    body: typeof blog.body === 'string' ? blog.body.slice(0, 50_000) : '',
    cover_image: cleanUrl(blog.cover_image),
    read_time: Math.min(Math.max(Math.floor(Number(blog.read_time) || 3), 1), 120),
    tags: cleanTags(blog.tags),
    created_at: cleanText(blog.created_at, 80),
  })).filter(blog => blog.title && blog.slug)

  return NextResponse.json({ blogs }, {
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
