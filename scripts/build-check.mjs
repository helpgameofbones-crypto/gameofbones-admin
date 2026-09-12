import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// The production app requires Supabase at runtime. For a local compile/page-data
// check, use harmless placeholders so route modules can be evaluated without
// exposing or inventing credentials. Real values are still required in Vercel.
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://local-build-check.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-build-check-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-build-check-service-role-key',
  GOB_DATA_ENCRYPTION_KEY: process.env.GOB_DATA_ENCRYPTION_KEY || 'local-build-check-encryption-key',
  GOB_ACCOUNT_SESSION_SECRET: process.env.GOB_ACCOUNT_SESSION_SECRET || 'local-build-check-session-secret',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_local_build_check',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'local-build-check-secret',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'local-build-check-webhook',
}

const nextCli = resolve('node_modules', 'next', 'dist', 'bin', 'next')
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  stdio: 'inherit',
  env,
})

process.exit(result.status ?? 1)
