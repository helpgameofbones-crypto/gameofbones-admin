import { NextResponse } from 'next/server'
import { runGA4Report } from '@/app/lib/ga4'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [durationRes, newVsReturningRes] = await Promise.all([
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'averageSessionDuration' }],
      }),
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'totalUsers' }],
      }),
    ])

    const avgEngagementSeconds = Number(
      durationRes.rows?.[0]?.metricValues?.[0]?.value || 0
    )

    let newUsers = 0
    let returningUsers = 0
    for (const row of newVsReturningRes.rows || []) {
      const label = row.dimensionValues?.[0]?.value
      const value = Number(row.metricValues?.[0]?.value || 0)
      if (label === 'new') newUsers = value
      else if (label === 'returning') returningUsers = value
    }

    return NextResponse.json({
      avgEngagementSeconds: Math.round(avgEngagementSeconds),
      newUsers,
      returningUsers,
    })
  } catch (error: any) {
    console.error('GA4 engagement error:', error.message)
    return NextResponse.json({ avgEngagementSeconds: 0, newUsers: 0, returningUsers: 0 })
  }
}
