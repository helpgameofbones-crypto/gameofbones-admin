'use client'

import { useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

type Result = { eligible: number; sent: string[]; skipped: string[]; failed: string[] }

export default function OctoberBirthdayOffersPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState('')

  async function send() {
    setState('sending')
    setMessage('Creating private 25% birthday rewards and sending the October emails…')
    try {
      const response = await authedFetch('/api/admin/send-october-birthday-offers', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The birthday campaign could not be sent.')
      setResult(body)
      setState('done')
      setMessage(`Campaign complete: ${body.sent.length} sent, ${body.skipped.length} already processed, ${body.failed.length} failed.`)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Unable to send the October birthday offers.')
    }
  }

  return <main style={{ maxWidth: 700, margin: '56px auto', padding: 28, color: '#173d2b' }}>
    <p style={{ color: '#bd812a', fontSize: 12, letterSpacing: '.12em', fontWeight: 800 }}>PRIVATE BIRTHDAY CAMPAIGN</p>
    <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, margin: '8px 0 16px' }}>October birthday treats.</h1>
    <p style={{ lineHeight: 1.6, color: '#526b5c' }}>Each October birthday record with an email receives one private code for <strong>25% off treats, with no minimum order value</strong>. Codes are one use and valid through 31 October 2026. Each email includes a marketing-unsubscribe link.</p>
    <button onClick={send} disabled={state === 'sending' || state === 'done'} style={{ marginTop: 18, background: '#173d2b', color: '#fff', border: 0, padding: '13px 18px', fontWeight: 800, cursor: state === 'sending' || state === 'done' ? 'wait' : 'pointer', opacity: state === 'sending' || state === 'done' ? .65 : 1 }}>{state === 'sending' ? 'Sending birthday offers…' : state === 'done' ? 'Birthday offers sent' : 'Send October birthday offers'}</button>
    {message && <p role="status" style={{ marginTop: 18, padding: 14, background: state === 'error' ? '#f9e1da' : '#edf4ea', color: state === 'error' ? '#8b2721' : '#24593d', lineHeight: 1.5 }}>{message}</p>}
    {result && <div style={{ marginTop: 18, padding: 16, background: '#fffdf9', border: '1px solid #dfd3c1' }}>
      <strong>Send record</strong>
      <p style={{ margin: '8px 0 0' }}>Eligible: {result.eligible} · Sent: {result.sent.length} · Already processed: {result.skipped.length} · Failed: {result.failed.length}</p>
      {result.failed.length > 0 && <p style={{ margin: '8px 0 0', color: '#8b2721' }}>Failed: {result.failed.join(', ')}</p>}
    </div>}
  </main>
}
