import { Resend } from 'resend'

export async function sendCustomerLoginCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Email delivery is not configured')
  const resend = new Resend(apiKey)
  return resend.emails.send({
    from,
    to: email,
    subject: 'Your Game of Bones sign-in code',
    html: `<div style="font-family:Arial,sans-serif;color:#102c22;max-width:520px;margin:auto"><h1 style="font-size:24px">Your sign-in code</h1><p>Use this code to securely access your Game of Bones account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f7f0e4;padding:18px;text-align:center">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  })
}
