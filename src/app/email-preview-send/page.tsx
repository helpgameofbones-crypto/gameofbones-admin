'use client'

import { useState } from 'react'
import { authedFetch } from '@/app/lib/authedFetch'

export default function EmailPreviewSendPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  async function sendPreview() {
    setState('sending')
    setMessage('Sending the four production-template previews…')
    try {
      const response = await authedFetch('/api/internal/test-order-lifecycle-emails', { method: 'POST' })
      const body = await response.json()
      if (!response.ok || body.sent !== 4) throw new Error(body.error || 'The preview was not accepted by the email provider.')
      setState('sent')
      setMessage('Sent 4 previews to sahuanjan6@gmail.com: order confirmed, dispatched, out for delivery, and delivered.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Unable to send the email preview.')
    }
  }
  return <main style={{ maxWidth: 680, margin: '56px auto', padding: 28, color: '#173d2b' }}>
    <p style={{ color: '#bd812a', fontSize: 12, letterSpacing: '.12em', fontWeight: 800 }}>OWNER EMAIL PREVIEW</p>
    <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, margin: '8px 0 16px' }}>Check every delivery update.</h1>
    <p style={{ lineHeight: 1.6, color: '#526b5c' }}>This sends exactly four test emails to <strong>sahuanjan6@gmail.com</strong>. No customer records, orders, points, or delivery statuses are changed.</p>
    <button onClick={sendPreview} disabled={state === 'sending' || state === 'sent'} style={{ marginTop: 18, background: '#173d2b', color: '#fff', border: 0, padding: '13px 18px', fontWeight: 800, cursor: state === 'sending' || state === 'sent' ? 'wait' : 'pointer', opacity: state === 'sending' || state === 'sent' ? .65 : 1 }}>{state === 'sending' ? 'Sending previews…' : state === 'sent' ? 'Previews sent' : 'Send 4 email previews'}</button>
    {message && <p role="status" style={{ marginTop: 18, padding: 14, background: state === 'error' ? '#f9e1da' : '#edf4ea', color: state === 'error' ? '#8b2721' : '#24593d', lineHeight: 1.5 }}>{message}</p>}
  </main>
}
