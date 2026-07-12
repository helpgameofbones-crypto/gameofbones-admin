'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { authedFetch } from '@/app/lib/authedFetch'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOGO = 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/logo.jpeg'

const CAMPAIGNS = [
  {
    id: 'welcome',
    name: 'Welcome New Customers',
    emoji: '&#127881;',
    color: '#10b981',
    bg: '#f0fdf4',
    description: 'Send to customers who just placed their first order',
    subject: 'Welcome to the Game of Bones family!',
  },
  {
    id: 'winback',
    name: 'Win-Back Inactive Customers',
    emoji: '&#128148;',
    color: '#ef4444',
    bg: '#fef2f2',
    description: 'Send to customers who have not ordered in 60+ days',
    subject: 'We miss you and so does your pups treat jar!',
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale - 24 Hours Only',
    emoji: '&#9889;',
    color: '#f59e0b',
    bg: '#fefce8',
    description: 'Urgent 24-hour flash sale to drive quick orders',
    subject: '24-HOUR FLASH SALE - Up to 30% off ends tonight!',
  },
  {
    id: 'reorder',
    name: 'Reorder Reminder',
    emoji: '&#128260;',
    color: '#3b82f6',
    bg: '#eff6ff',
    description: 'Remind customers their treats are probably running low',
    subject: 'Is your pups treat jar running low?',
  },
  {
    id: 'new_product',
    name: 'New Product Launch',
    emoji: '&#128;',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    description: 'Announce a new product to all customers',
    subject: 'Just launched - your dog NEEDS to try this!',
  },
  {
    id: 'vip',
    name: 'VIP Customer Reward',
    emoji: '&#128081;',
    color: '#c8973a',
    bg: '#fefce8',
    description: 'Reward your top customers with an exclusive offer',
    subject: 'You are a VIP - exclusive offer inside!',
  },
  {
    id: 'birthday',
    name: 'Dog Birthday Campaign',
    emoji: '&#127874;',
    color: '#ec4899',
    bg: '#fdf2f8',
    description: 'Send to customers whose dog has a birthday this month',
    subject: 'Happy Birthday to your furry best friend!',
  },
  {
    id: 'referral',
    name: 'Refer a Friend',
    emoji: '&#128101;',
    color: '#06b6d4',
    bg: '#ecfeff',
    description: 'Ask happy customers to refer their friends',
    subject: 'Share the love - get rewarded for every friend you refer!',
  },
]

function buildHtml(name: string, campaign: any, coupon: string) {
  const bodies: Record<string, string> = {
    welcome: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#127881;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Welcome to the family, ${name}!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">Your pup is about to experience the purest, most natural treats in India. No preservatives. No additives. Just real food for real dogs.</p>
        <div style="display:flex;justify-content:center;gap:12px;margin:24px 0;flex-wrap:wrap">
          <div style="background:white;border-radius:12px;padding:16px;min-width:140px;text-align:center"><div style="font-size:28px">&#129460;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin-top:6px">100% Natural</div><div style="color:#9ca3af;font-size:11px;margin-top:2px">Zero preservatives</div></div>
          <div style="background:white;border-radius:12px;padding:16px;min-width:140px;text-align:center"><div style="font-size:28px">&#127470;&#127475;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin-top:6px">Made in India</div><div style="color:#9ca3af;font-size:11px;margin-top:2px">Locally sourced</div></div>
          <div style="background:white;border-radius:12px;padding:16px;min-width:140px;text-align:center"><div style="font-size:28px">&#10084;&#65039;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin-top:6px">Vet Approved</div><div style="color:#9ca3af;font-size:11px;margin-top:2px">Safe for all dogs</div></div>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #c8973a;border-radius:16px;padding:24px;margin:24px auto;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Your welcome gift</p><div style="font-size:32px;font-weight:800;color:#c8973a;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Use this code for 10% off your next order</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px;margin-top:8px">Shop Now</a>
      </div>`,
    winback: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#128148;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">We miss you, ${name}!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">It has been a while since your pup had their favourite Game of Bones treats. Come see what is new!</p>
        <div style="background:white;border-radius:16px;padding:24px;margin:24px auto;max-width:400px;text-align:left">
          <p style="margin:0 0 12px;font-weight:bold;color:#1a1008">What is new at Game of Bones:</p>
          <p style="margin:0 0 8px;color:#374151;font-size:14px">&#128031; New Fish Treats - Omega-3 rich sardines and rohu</p>
          <p style="margin:0 0 8px;color:#374151;font-size:14px">&#128016; Goat Organ Packs - Liver, kidney and heart mix</p>
          <p style="margin:0 0 8px;color:#374151;font-size:14px">&#128038; Larger sizes - Now available in 280g and 400g</p>
          <p style="margin:0 0 8px;color:#374151;font-size:14px">&#128230; Free delivery on orders above Rs 499</p>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #ef4444;border-radius:16px;padding:24px;margin:24px auto;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Special come-back offer</p><div style="font-size:32px;font-weight:800;color:#ef4444;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">15% off - valid for 48 hours only!</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#ef4444;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Come Back and Save</a>
      </div>`,
    flash_sale: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#9889;</div>
        <h2 style="color:#1a1008;margin:0 0 8px;font-size:24px">Hi ${name}! Flash Sale is LIVE!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">For the next 24 hours only, we are slashing prices on our most popular treats!</p>
        <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin:0 0 32px">
          <div style="background:white;border-radius:12px;padding:16px;min-width:130px;text-align:center"><div style="background:#ef4444;color:white;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:50px;display:inline-block;margin-bottom:8px">SALE</div><div style="font-size:28px">&#127831;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin:6px 0">Chicken Jerky</div><div style="color:#9ca3af;text-decoration:line-through;font-size:12px">Rs 329</div><div style="color:#ef4444;font-weight:900;font-size:20px">Rs 249</div></div>
          <div style="background:white;border-radius:12px;padding:16px;min-width:130px;text-align:center"><div style="background:#ef4444;color:white;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:50px;display:inline-block;margin-bottom:8px">SALE</div><div style="font-size:28px">&#128031;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin:6px 0">Fish Treats</div><div style="color:#9ca3af;text-decoration:line-through;font-size:12px">Rs 399</div><div style="color:#ef4444;font-weight:900;font-size:20px">Rs 299</div></div>
          <div style="background:white;border-radius:12px;padding:16px;min-width:130px;text-align:center"><div style="background:#ef4444;color:white;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:50px;display:inline-block;margin-bottom:8px">SALE</div><div style="font-size:28px">&#129424;</div><div style="font-weight:bold;color:#1a1008;font-size:13px;margin:6px 0">Goat Organs</div><div style="color:#9ca3af;text-decoration:line-through;font-size:12px">Rs 449</div><div style="color:#ef4444;font-weight:900;font-size:20px">Rs 329</div></div>
        </div>
        ${coupon ? `<div style="background:white;border:3px solid #f59e0b;border-radius:16px;padding:24px;margin:0 auto 24px;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Use code at checkout</p><div style="font-size:36px;font-weight:900;color:#f59e0b;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Expires midnight tonight</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#f59e0b;color:#1a1008;padding:16px 40px;text-decoration:none;border-radius:50px;font-weight:900;display:inline-block;font-size:16px">Shop the Sale Now</a>
      </div>`,
    reorder: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#128260;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Time to restock, ${name}!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">Based on your order history, your pups treats are probably running low. Do not let the treat jar go empty!</p>
        <div style="background:white;border-radius:16px;padding:24px;margin:0 auto 24px;max-width:400px;text-align:left">
          <p style="margin:0 0 12px;font-weight:bold;color:#1a1008">Why reorder now?</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px">&#9889; Fast delivery - 4 to 7 business days</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px">&#128230; Free delivery on orders above Rs 499</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px">&#127881; Loyalty points on every order</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px">&#128054; Your dog will love you for it</p>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #3b82f6;border-radius:16px;padding:24px;margin:24px auto;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Reorder discount</p><div style="font-size:32px;font-weight:800;color:#3b82f6;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">10% off your next order</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#3b82f6;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Restock Now</a>
      </div>`,
    new_product: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#128;&#65039;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hi ${name}, something new is here!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">We have been working hard to bring you the best natural treats for your pup. Today we are thrilled to announce our latest addition!</p>
        <div style="background:white;border-radius:20px;padding:32px;margin:0 auto 24px;max-width:400px;text-align:center;border:2px solid #8b5cf6">
          <div style="font-size:64px;margin-bottom:16px">&#128031;</div>
          <h3 style="color:#1a1008;margin:0 0 8px;font-size:22px">Ocean Fish Treats</h3>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px">Wild-caught sardines and rohu, air-dried to perfection. Rich in Omega-3 for a shiny coat and healthy joints.</p>
          <div style="font-size:24px;font-weight:900;color:#8b5cf6">Starting at Rs 299</div>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #8b5cf6;border-radius:16px;padding:24px;margin:0 auto 24px;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Launch offer</p><div style="font-size:32px;font-weight:800;color:#8b5cf6;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">20% off on the new product</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#8b5cf6;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Try It Now</a>
      </div>`,
    vip: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#128081;</div>
        <div style="background:white;border-radius:20px;padding:24px;margin:0 auto 24px;max-width:400px;border:2px solid #c8973a">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px">This offer is exclusively for</p>
          <h2 style="color:#c8973a;margin:0;font-size:28px;font-weight:900">${name}</h2>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">One of our most valued customers</p>
        </div>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">You have been with us from the beginning. You are not just a customer - you are part of the Game of Bones family. And family gets special treatment.</p>
        ${coupon ? `<div style="background:linear-gradient(135deg,#c8973a,#92400e);border-radius:16px;padding:24px;margin:0 auto 24px;max-width:300px"><p style="margin:0 0 8px;color:rgba(255,255,255,0.8);font-size:13px">Your VIP code</p><div style="font-size:36px;font-weight:900;color:white;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:12px">25% off - valid for 7 days</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Claim Your VIP Offer</a>
      </div>`,
    birthday: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#127874;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hey ${name}!</h2>
