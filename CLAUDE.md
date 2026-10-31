@AGENTS.md

# Game of Bones – admin (gameofbones-admin)

Next.js app on Vercel (gameofbones-admin.vercel.app). It is the order service behind gameofbones.in: the storefront proxies `/api/*` here. Database: Supabase project `syuostlqzzinigqwjzap`.

## Never
- **Never commit secrets.** Keys, passwords and tokens live only in Vercel → Settings → Environment Variables. `.env*` files are git-ignored; keep it that way. (A Gmail app password leaked through `.env.local` in July 2026.)
- Never open or call the admin `/orders` page or `GET /api/admin/orders` casually: it auto-books Delhivery shipments for ready orders.
- Never book a prepaid shipment from a browser-supplied `transaction_id`. Prepaid orders are confirmed only by the signed Razorpay webhook, and only when `payment.amount` covers the order's `grand_total` (otherwise the order is put `on_hold`).
- Never publish fake or seeded reviews. Old-store reviews (no order_id) are labelled "customer review"; website-order reviews are "verified dog parent".
- Never send customer emails or WhatsApp messages, or change ad budgets, without the owner's OK.

## Rules
- Health wording in any customer-facing text: say "naturally contains"; no medical claims.
- Customer personal data (name, phone, email, address) is encrypted at rest (`pii-crypto`). Do not add routes that return it without `requireAdmin`.
- Public routes must use `rejectUnexpectedOrigin` and `rateLimit` from `src/app/lib/public-request.ts`.
- Cron routes are protected once, in `src/proxy.ts` (fails closed if `CRON_SECRET` is unset). Add any new cron path to `CRON_ROUTES` there and to `vercel.json`.
- Supabase returns at most 1,000 rows per request: use `fetchAllRows` (`src/app/lib/fetch-all.ts`) for reports and totals.
- Delivery: free on full packs; trial packs pay ₹50 below ₹300 (`checkout-pricing.ts`). Online payment: ₹30 off; COD: ₹40 fee.

## Before deploying
- `npx tsc --noEmit -p .` must pass.
- Deploys happen automatically from `main` on Vercel.
