import { NextRequest, NextResponse } from 'next/server'
import { runGA4Report } from '@/app/lib/ga4'
import { requireAdmin } from '@/app/lib/requireAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdmin(req)
    if (authError) return authError

    const data = await runGA4Report({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'conversions' },
      ],
    })

    const values = data.rows?.[0]?.metricValues || []

    return NextResponse.json({
      activeUsers: Number(values[0]?.value || 0),
      sessions: Number(values[1]?.value || 0),
      bounceRate: Math.round(Number(values[2]?.value || 0) * 100) / 100,
      conversions: Number(values[3]?.value || 0),
    })
  } catch (error: any) {
    console.error('GA4 analytics error:', error.message)
    return NextResponse.json({
      activeUsers: 0, sessions: 0, bounceRate: 0, conversions: 0,
      error: error.message,
    })
  }
}
