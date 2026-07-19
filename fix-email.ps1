New-Item -ItemType Directory -Force -Path "src\app\lib" | Out-Null
@'
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
'@ | Set-Content -Path "src\app\lib\emailClient.ts" -Encoding utf8

$files = @(
  "src\app\api\abandoned-cart\route.ts",
  "src\app\api\abandoned-cart-followup\route.ts",
  "src\app\api\auto-cancel-cod\route.ts",
  "src\app\api\award-loyalty-points\route.ts",
  "src\app\api\birthday-emails\route.ts",
  "src\app\api\care-library-drip\route.ts",
  "src\app\api\daily-report\route.ts",
  "src\app\api\daily-sales\route.ts",
  "src\app\api\low-stock\route.ts",
  "src\app\api\nps-survey\route.ts",
  "src\app\api\order-reminders\route.ts",
  "src\app\api\orders\route.ts",
  "src\app\api\review-requests\route.ts",
  "src\app\api\send-campaign\route.ts"
)

foreach ($f in $files) {
  if (Test-Path $f) {
    $content = Get-Content $f -Raw
    $content = $content -replace "import \{ Resend \} from 'resend'", "import { resend } from '@/app/lib/emailClient'"
    $content = $content -replace "const resend\s*=\s*new Resend\(process\.env\.RESEND_API_KEY\)\r?\n", ""
    Set-Content -Path $f -Value $content -Encoding utf8 -NoNewline
    Write-Host "Fixed: $f"
  } else {
    Write-Host "NOT FOUND: $f"
  }
}