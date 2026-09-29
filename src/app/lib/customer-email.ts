import { Resend } from 'resend'
import { resend as gmail } from '@/app/lib/emailClient'
import { marketingUnsubscribeUrl } from '@/app/lib/marketing-unsubscribe'

function displaySender(from: string) {
  return from.includes('<') ? from : `Game of Bones <${from}>`
}

export async function sendCustomerLoginCode(email: string, code: string) {
  return sendCustomerCode(email, code, 'sign-in')
}

export async function sendCustomerAccountCreationCode(email: string, code: string) {
  return sendCustomerCode(email, code, 'account verification')
}

async function sendCustomerCode(email: string, code: string, purpose: 'sign-in' | 'account verification') {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const unsubscribeUrl = marketingUnsubscribeUrl(email)
  const accountCreation = purpose === 'account verification'
  const message = {
    to: email,
    subject: accountCreation ? 'Your Game of Bones account verification code' : 'Your Game of Bones sign-in code',
    text: `Your Game of Bones ${purpose} code: ${code}\n\nUse this code to securely ${accountCreation ? 'create your account' : 'access your account'}. It expires in 10 minutes. If you did not request it, you can ignore this email.\n\nTo stop marketing emails only: ${unsubscribeUrl}`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f1e9;color:#173c2d;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your secure Game of Bones ${purpose} code is ready.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e9;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;">
          <tr><td align="center" style="padding:30px 32px 18px;background:#173c2d;">
            <img src="https://gameofbones.in/assets/gob-logo.png" width="160" alt="Game of Bones" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
          </td></tr>
          <tr><td style="padding:34px 32px 14px;">
            <h1 style="margin:0 0 16px;font-size:28px;line-height:34px;color:#173c2d;">Your ${purpose} code</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#315246;">Use this code to securely ${accountCreation ? 'create your Game of Bones account' : 'access your Game of Bones account'}.</p>
          </td></tr>
          <tr><td style="padding:10px 32px 26px;">
            <div style="background:#f1eadc;border-radius:12px;padding:20px 12px;text-align:center;font-size:34px;line-height:40px;font-weight:700;letter-spacing:8px;color:#173c2d;">${code}</div>
          </td></tr>
          <tr><td style="padding:0 32px 34px;">
            <p style="margin:0;font-size:15px;line-height:23px;color:#315246;">This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:18px 32px;background:#f5f1e9;border-top:1px solid #e7dfd0;">
            <p style="margin:0;font-size:12px;line-height:18px;color:#62796e;">This is a security email about your Game of Bones account.</p>
            <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#62796e;">Want fewer offers? <a href="${unsubscribeUrl}" style="color:#173c2d;text-decoration:underline;">Unsubscribe from marketing emails</a>. Sign-in, order and security emails will still be delivered.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  }

  // Resend is preferred when a verified sending domain is available. The
  // existing Gmail setup is a deliberate fallback so account access does not
  // silently break while Resend is being configured or verified.
  if (apiKey && from) {
    const result = await new Resend(apiKey).emails.send({ from: displaySender(from), ...message })
    if (result.error) throw new Error('Email delivery provider rejected the sign-in code')
    return
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    await gmail.emails.send(message)
    return
  }
  throw new Error('Email delivery is not configured')
}
