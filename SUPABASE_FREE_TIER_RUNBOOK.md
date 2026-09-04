# Supabase Free Tier Guardrails

The current project is healthy: database 31 MB / 500 MB, Storage 35 MB / 1 GB, and total egress below 5% of its monthly allowance.

## Protections implemented in the admin

- Product images are resized to a maximum 1600 px and rejected if their optimized file remains over 2 MB.
- Source images over 8 MB are rejected before upload.
- Product video is limited to MP4/WebM and 12 MB per file.
- Replacing product media removes the previous object from the `product-images` bucket, preventing orphaned uploads from accumulating.
- The storefront should serve public product media through its CDN URLs and should never ship the Service Role key to visitors.

## Monthly owner check (five minutes)

Open **Supabase Dashboard → Organization → Usage** near the middle and end of each billing cycle. Take action at these thresholds:

| Usage | Threshold | Action |
| --- | --- | --- |
| Database size | 300 MB | Archive old audit/events and avoid copying order payloads into new tables. |
| Storage | 700 MB | Delete unused media; move longer campaign videos to a video host rather than Supabase Storage. |
| Cached or uncached egress | 3.5 GB | Identify the most requested Storage objects / API paths; replace oversized media. |
| Auth MAU | 40,000 | Review marketing/login traffic before the 50,000 free-plan limit. |

## What not to do

- Do not upload raw camera videos or uncompressed catalog photographs.
- Do not create a separate duplicate image for each product variant when one shared media URL will do.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the storefront or admin browser bundle.
- Do not poll order, analytics, or tracking APIs every few seconds; fetch on navigation or an explicit refresh instead.

Supabase free-plan projects can be paused after a week of inactivity, so keep a separate uptime/operations plan before relying on it for daily production administration.
