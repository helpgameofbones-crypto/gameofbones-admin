import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function buildReviewRequestEmail(input: { firstName: string; products: string[] }) {
  const products = input.products.slice(0, 4).map(escapeHtml).join(', ') || 'your treats'
  return {
    subject: 'Tell us how treat time went — earn up to 150 points',
    html: lifecycleEmailTemplate({
      eyebrow: 'A note from the treat jar',
      title: 'How did your pup like the treats?',
      introHtml: `Hi ${escapeHtml(input.firstName || 'there')}, we’d love an honest review of ${products}. Your account will show only the treats from your delivered orders.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:14px;font-weight:800;letter-spacing:.4px">100 POINTS FOR A REVIEW · 150 WITH A DOG PHOTO</div><div style="border-top:1px solid #dfc988;margin:14px 0 12px"></div><div style="font-size:13px;line-height:1.5">After a quick moderation check, we’ll add 100 points for your review — or 150 points when you add a photo of your dog enjoying the treats.</div>`, 'left'),
      ctaLabel: 'Review my treats',
      ctaUrl: 'https://gameofbones.in/account',
      noteHtml: 'Please sign in with the email address linked to your order. One rewarded review is available for each product you have purchased.',
    }),
  }
}
