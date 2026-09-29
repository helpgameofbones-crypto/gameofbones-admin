import nodemailer from 'nodemailer'

import { Resend } from 'resend'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export const resend = {
  emails: {
    send: (opts: { from?: string; to: string | string[]; subject: string; html: string; text?: string }) => {
      const apiKey = process.env.RESEND_API_KEY
      const from = process.env.RESEND_FROM_EMAIL

      // Prefer the verified Resend domain for every transactional email.
      // Legacy callers still specify Resend's temporary onboarding address,
      // so the configured verified sender intentionally takes precedence.
      if (apiKey && from) {
        return new Resend(apiKey).emails.send({ ...opts, from })
      }

      // Keep Gmail as a safe fallback until Resend is configured.
      return transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      })
    },
  },
}
