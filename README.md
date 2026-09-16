# Game of Bones Admin

The protected operations dashboard for orders, products, fulfilment, finance, content, rewards, customers, and marketing.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the required values from the production provider dashboards. Never commit `.env.local`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Required production variables

| Area | Variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Admin protection | `GOB_ACCOUNT_SESSION_SECRET`, `ADMIN_EMAILS` |
| Stored customer data | `GOB_DATA_ENCRYPTION_KEY` |
| Scheduled jobs | `CRON_SECRET` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Delivery | `DELHIVERY_API_TOKEN`, plus `DELHIVERY_PICKUP_LOCATION` set to the exact pickup name in Delhivery One |
| Email | `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, or the Gmail fallback variables |

`ADMIN_EMAILS` is a comma-separated allowlist, for example:

```text
owner@gameofbones.in,operations@gameofbones.in
```

## Deployment checklist

Before making a deployment live:

- Confirm every required variable is present in Vercel Production.
- Set `NEXT_PUBLIC_SITE_URL` to the final `https://` storefront URL.
- Confirm the Supabase project is active and has available database, storage, and egress capacity.
- Deploy and sign in with an allowlisted admin email.
- Test one safe record in each area: product save, order status update, coupon creation, content upload, and stock update.
- Run one Razorpay test payment, a Delhivery PIN-code lookup, and an order tracking lookup.
- Confirm a test email sends through the configured email provider.
- Review Vercel Runtime Logs after the first scheduled-job run, especially `/api/migrate-legacy-pii`.

## Scheduled jobs

The scheduled routes are configured in `vercel.json` and all verify `CRON_SECRET` before they work. On Vercel Hobby, jobs can run once daily but may execute at any point during their scheduled hour. Keep them idempotent and do not rely on exact-to-the-minute timing.

## Verification

```bash
npx tsc --noEmit
npm run build
```

The project has legacy lint violations that are not production-build blockers. Address them gradually in focused batches; avoid disabling lint rules globally just to make the number disappear.
