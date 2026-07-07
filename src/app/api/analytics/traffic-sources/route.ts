import { NextResponse } from 'next/server'
import { runGA4Report } from '@/app/lib/ga4'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await runGA4Report({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    })

    const sources = (data.rows || []).map((row: any) => ({
      source: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: Number(row.metricValues?.[0]?.value || 0),
    }))

    return NextResponse.json(sources)
  } catch (error: any) {
    console.error('GA4 traffic-sources error:', error.message)
    return NextResponse.json([])
  }
}
