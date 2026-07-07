import { NextResponse } from 'next/server'
import { runGA4Report } from '@/app/lib/ga4'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await runGA4Report({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'city' }, { name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    })

    const cities = (data.rows || []).map((row: any) => ({
      city: row.dimensionValues?.[0]?.value || 'Unknown',
      country: row.dimensionValues?.[1]?.value || '',
      users: Number(row.metricValues?.[0]?.value || 0),
    }))

    return NextResponse.json(cities)
  } catch (error: any) {
    console.error('GA4 geography error:', error.message)
    return NextResponse.json([])
  }
}
