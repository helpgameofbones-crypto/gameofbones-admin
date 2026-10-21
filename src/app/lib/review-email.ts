import { emailCard, lifecycleEmailTemplate } from '@/app/lib/lifecycle-email-template'

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function buildReviewRequestEmail(input: { firstName: string; products: string[] }) {
  const list = input.products.slice(0, 4)
  const products = list.map(escapeHtml).join(', ') || 'your treats'
  const pet = list.length && list.every(name => /cat/i.test(name)) ? 'your cat' : 'your dog'
  const subjectItem = list.length === 1 ? `the ${list[0]}` : 'the treats'
  return {
    subject: `How did ${pet} like ${subjectItem}?`,
    html: lifecycleEmailTemplate({
      eyebrow: 'A note from the treat jar',
      title: `How did ${pet} like ${escapeHtml(subjectItem)}?`,
      introHtml: `Hi ${escapeHtml(input.firstName || 'there')}, your ${products} reached you recently, and we’d love to know how treat time went. Was it a hit, a “meh”, or something you’d change? Your honest review helps other pet parents pick the right treat, and helps us make better ones.`,
      detailHtml: emailCard(`<div style="color:#dc650b;font-size:14px;font-weight:800;letter-spacing:.4px">100 POINTS FOR A REVIEW · 150 WITH A PHOTO</div><div style="border-top:1px solid #dfc988;margin:14px 0 12px"></div><div style="font-size:13px;line-height:1.5">As a thank-you, every approved review earns 100 reward points, or 150 with a photo — the same whether you give 5 stars or 2.</div>`, 'left'),
      ctaLabel: 'Write a 30-second review',
      ctaUrl: 'https://gameofbones.in/account',
      noteHtml: 'Sign in with the email or phone linked to your order. Thank you for trusting a small Kalyan kitchen with your pet’s treats. — Team Game of Bones · WhatsApp +91 90825 03295',
    }),
  }
}
