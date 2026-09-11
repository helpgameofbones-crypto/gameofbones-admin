'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

type Review = { id: string; customer_name?: string; customer_phone?: string; rating?: number; review_text?: string; photo_url?: string; created_at?: string; status?: string; review_points_awarded_at?: string }

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await authedFetch('/api/admin/reviews?status=pending')
      const data = await response.json()
      setReviews(response.ok && Array.isArray(data.reviews) ? data.reviews : [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function moderate(id: string, action: 'approve' | 'reject') {
    setBusy(id); setMessage('')
    try {
      const response = await authedFetch('/api/admin/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
      const data = await response.json()
      if (!response.ok) { setMessage(data.error || 'Unable to update the review.'); return }
      setReviews(current => current.filter(review => review.id !== id))
      setMessage(action === 'approve' ? (data.alreadyAwarded ? 'Review approved. Its reward was already recorded.' : 'Review approved and 50 points awarded.') : 'Review rejected.')
    } finally { setBusy(null) }
  }

  return <div style={{ maxWidth: 1080, margin: '0 auto', padding: 28 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', marginBottom: 24 }}>
      <div><h1 style={{ margin: 0, color: '#1a1008', fontSize: 29 }}>Review approval</h1><p style={{ color: '#6b7280', margin: '7px 0 0', fontSize: 14 }}>Approve genuine customer reviews. Each approval awards 50 points once.</p></div>
      <button onClick={load} style={{ border: '1px solid #d6c9b8', background: '#fff', padding: '9px 14px', cursor: 'pointer', borderRadius: 5, fontWeight: 700 }}>Refresh</button>
    </div>
    {message && <div style={{ marginBottom: 16, padding: 12, background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6 }}>{message}</div>}
    {loading ? <div style={{ color: '#6b7280', padding: 30 }}>Loading reviews…</div> : reviews.length === 0 ? <div style={{ background: '#fff', border: '1px solid #e7ded0', borderRadius: 8, padding: 32, color: '#6b7280', textAlign: 'center' }}>No pending reviews.</div> : <div style={{ display: 'grid', gap: 14 }}>{reviews.map(review => <article key={review.id} style={{ background: '#fff', border: '1px solid #e7ded0', borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div><strong style={{ color: '#1a1008' }}>{review.customer_name || 'Customer'}</strong><div style={{ color: '#c88722', marginTop: 5 }}>{'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</div></div><div style={{ color: '#6b7280', fontSize: 12 }}>{review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div></div>
      <p style={{ color: '#374151', lineHeight: 1.55, margin: '14px 0' }}>{review.review_text || 'No review text supplied.'}</p>
      {review.photo_url && <img src={review.photo_url} alt="Customer review" style={{ display: 'block', width: 120, height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 15 }} />}
      <div style={{ display: 'flex', gap: 9 }}><button disabled={busy === review.id} onClick={() => moderate(review.id, 'approve')} style={{ border: 0, background: '#1f6b4d', color: '#fff', padding: '10px 15px', cursor: 'pointer', borderRadius: 5, fontWeight: 700 }}>{busy === review.id ? 'Saving…' : 'Approve + 50 points'}</button><button disabled={busy === review.id} onClick={() => moderate(review.id, 'reject')} style={{ border: '1px solid #d6c9b8', background: '#fff', color: '#5f3219', padding: '10px 15px', cursor: 'pointer', borderRadius: 5, fontWeight: 700 }}>Reject</button></div>
    </article>)}</div>}
  </div>
}
