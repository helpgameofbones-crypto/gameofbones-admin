import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Server-rendered journal article. gameofbones.in rewrites /blog/:slug here so readers and
// search engines get the real article body from the blogs table (not a client-rendered shell).
// The page chrome (header, footer, styles) comes from a static journal page on the website.
const ORIGIN = 'https://gameofbones.in'
const SHELL = `${ORIGIN}/seo-static/blog/fish-treats-underrated.html`
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export const revalidate = 600

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
// Article bodies are written by the team in the admin; still strip anything executable.
const safeBody = (html: string) => html
  .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, '')
  .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
const fmtDate = (value: unknown) => { const d = new Date(String(value || '')); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) }

async function shell() {
  const res = await fetch(SHELL, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`shell ${res.status}`)
  return res.text()
}

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get('slug') || '').toLowerCase()
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return new NextResponse('Not found', { status: 404 })
  try {
    const [{ data: post, error }, template] = await Promise.all([
      db.from('blogs').select('title,slug,category,excerpt,body,cover_image,read_time,published_at,updated_at,created_at').eq('slug', slug).eq('is_published', true).maybeSingle(),
      shell(),
    ])
    if (error) throw error
    if (!post) return NextResponse.redirect(`${ORIGIN}/blog`, 307)
    const url = `${ORIGIN}/blog/${post.slug}`
    const title = String(post.title || 'Game of Bones Journal')
    const description = String(post.excerpt || '').slice(0, 300)
    const image = /^https:\/\//.test(String(post.cover_image || '')) ? String(post.cover_image) : `${ORIGIN}/assets/hero-real-dogs.png`
    const published = post.published_at || post.created_at
    const modified = post.updated_at || published
    const schema = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Game of Bones', url: `${ORIGIN}/`, logo: `${ORIGIN}/assets/gob-logo.png` },
      { '@type': 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: url, headline: title, description, image, datePublished: published, dateModified: modified, author: { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Game of Bones' }, publisher: { '@id': `${ORIGIN}/#organization` } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` }, { '@type': 'ListItem', position: 2, name: 'Journal', item: `${ORIGIN}/blog` }, { '@type': 'ListItem', position: 3, name: title, item: url }] },
    ] }
    const meta = [post.category, post.read_time ? `${post.read_time} read` : '', fmtDate(modified) ? `Updated ${fmtDate(modified)}` : '', 'Game of Bones team'].filter(Boolean).map(esc).join(' · ')
    const main = `<main class="journal-static-main"><article class="journal-static-article" aria-labelledby="article-title"><a class="text-link" href="/blog">← Back to the journal</a><header><p class="eyebrow">Game of Bones field guide</p><h1 class="display" id="article-title">${esc(title)}</h1><p class="lead">${esc(description)}</p><p class="journal-reader-meta">${meta}</p></header><section class="journal-article-body">${safeBody(String(post.body || ''))}</section><section><p><a class="text-link" href="/products">Shop single-ingredient treats →</a></p></section></article></main>`
    const html = template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | Game of Bones Journal</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
      .replace(/(<meta (?:property|name)="(?:og|twitter):title" content=")[^"]*/g, `$1${esc(title)} | Game of Bones Journal`)
      .replace(/(<meta (?:property|name)="(?:og|twitter):description" content=")[^"]*/g, `$1${esc(description)}`)
      .replace(/(<meta (?:property|name)="(?:og|twitter):image" content=")[^"]*/g, `$1${esc(image)}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
      .replace(/<script id="gob-static-article-schema" type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="gob-static-article-schema" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`)
      .replace(/<main[\s\S]*?<\/main>/, main)
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=600, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('Blog page render failed', error)
    return NextResponse.redirect(`${ORIGIN}/seo-static/blog/${slug}.html`, 307)
  }
}
