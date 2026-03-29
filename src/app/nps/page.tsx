'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NPSPage() {
  const [surveys, setSurveys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSurveys() }, [])

  async function fetchSurveys() {
    const { data } = await supabase
      .from('nps_surveys')
      .select('*')
      .order('sent_at', { ascending: false })
    setSurveys(data || [])
    setLoading(false)
  }

  const responded   = surveys.filter(s => s.score !== null)
  const promoters   = responded.filter(s => s.score >= 9).length
  const passives    = responded.filter(s => s.score >= 7 && s.score <= 8).length
  const detractors  = responded.filter(s => s.score <= 6).length
  const npsScore    = responded.length
    ? Math.round(((promoters - detractors) / responded.length) * 100)
    : null
  const responseRate = surveys.length
    ? Math.round((responded.length / surveys.length) * 100)
    : 0
  const avgScore = responded.length
    ? (responded.reduce((s, r) => s + r.score, 0) / responded.length).toFixed(1)
    : null

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders',    href: '/orders' },
    { label: 'Customers', href: '/customers' },
    { label: 'NPS',       href: '/nps' },
    { label: 'Analytics', href: '/analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {navLinks.map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>NPS Survey</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Customer satisfaction — sent 7 days after delivery
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'NPS Score',      value: npsScore !== null ? npsScore : '—',   icon: '⭐', color: npsScore !== null && npsScore >= 50 ? '#10b981' : '#f59e0b' },
            { label: 'Avg Rating',     value: avgScore ? avgScore + '/10' : '—',    icon: '📊', color: '#3b82f6' },
            { label: 'Response Rate',  value: responseRate + '%',                   icon: '📬', color: '#8b5cf6' },
            { label: 'Total Surveys',  value: surveys.length,                       icon: '📝', color: '#6b7280' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {responded.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Promoters (9-10)',   value: promoters,  color: '#10b981', bg: '#f0fdf4', pct: Math.round((promoters/responded.length)*100) },
              { label: 'Passives (7-8)',     value: passives,   color: '#f59e0b', bg: '#fefce8', pct: Math.round((passives/responded.length)*100) },
              { label: 'Detractors (0-6)',   value: detractors, color: '#ef4444', bg: '#fef2f2', pct: Math.round((detractors/responded.length)*100) },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium" style={{ color: '#374151' }}>{card.label}</div>
                  <div className="font-bold text-lg" style={{ color: card.color }}>{card.value}</div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full"
                    style={{ width: card.pct + '%', background: card.color }} />
                </div>
                <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{card.pct}%</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer','Order','Score','Feedback','Sent','Responded'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>Loading...</td></tr>
              ) : surveys.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9ca3af' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
                  <div>No surveys sent yet.</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Surveys are sent automatically 7 days after delivery.</div>
                </td></tr>
              ) : surveys.map(survey => (
                <tr key={survey.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#111827' }}>{survey.customer_name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{survey.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#c8973a' }}>
                    {survey.order_id?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    {survey.score !== null ? (
                      <span className="font-bold text-lg px-2 py-1 rounded-lg"
                        style={{
                          background: survey.score >= 9 ? '#dcfce7' : survey.score >= 7 ? '#fef3c7' : '#fef2f2',
                          color: survey.score >= 9 ? '#166534' : survey.score >= 7 ? '#92400e' : '#ef4444'
                        }}>
                        {survey.score}/10
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                    {survey.feedback || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>
                    {new Date(survey.sent_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>
                    {survey.responded_at
                      ? new Date(survey.responded_at).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
