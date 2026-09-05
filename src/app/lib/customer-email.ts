import { Resend } from 'resend'
import { resend as gmail } from '@/app/lib/emailClient'

export async function sendCustomerLoginCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const message = {
    to: email,
    subject: 'Your Game of Bones sign-in code',
    html: `<div style="font-family:Arial,sans-serif;color:#102c22;max-width:520px;margin:auto"><h1 style="font-size:24px">Your sign-in code</h1><p>Use this code to securely access your Game of Bones account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f7f0e4;padding:18px;text-align:center">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  }

  // Resend is preferred when a verified sending domain is available. The
  // existing Gmail setup is a deliberate fallback so account access does not
  // silently break while Resend is being configured or verified.
  if (apiKey && from) {
    return new Resend(apiKey).emails.send({ from, ...message })
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return gmail.emails.send(message)
  }
  throw new Error('Email delivery is not configured')
}
