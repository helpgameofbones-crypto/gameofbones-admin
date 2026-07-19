import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export const resend = {
  emails: {
    send: (opts: { from?: string; to: string | string[]; subject: string; html: string }) =>
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
  },
}
