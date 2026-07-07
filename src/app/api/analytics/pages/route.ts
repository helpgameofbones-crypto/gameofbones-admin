import { NextResponse } from 'next/server'
import { runGA4Report } from '@/app/lib/ga4'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [topPagesRes, landingPagesRes] = await Promise.all([
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePathPlusQueryString' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    ])

    const topPages = (topPagesRes.rows || []).map((row: any) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      title: row.dimensionValues?.[1]?.value || '',
      views: Number(row.metricValues?.[0]?.value || 0),
    }))

    const landingPages = (landingPagesRes.rows || []).map((row: any) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      sessions: Number(row.metricValues?.[0]?.value || 0),
    }))

    return NextResponse.json({ topPages, landingPages })
  } catch (error: any) {
    console.error('GA4 pages error:', error.message)
    return NextResponse.json({ topPages: [], landingPages: [] })
  }
}
