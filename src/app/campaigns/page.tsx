'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAMPAIGNS = [
  {
    id: 'welcome',
    name: 'Welcome New Customers',
    emoji: '🎉',
    color: '#10b981',
    bg: '#f0fdf4',
    description: 'Send to customers who just placed their first order',
    subject: '🐾 Welcome to the Game of Bones family!',
    previewText: 'Your pup is about to discover their new favourite treats',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🐾</div>
          <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
          <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">Premium Raw Treats for Happy Dogs</p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <div style="font-size:56px;margin-bottom:16px">🎉</div>
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Welcome to the family, ${name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
            Your pup is about to experience the purest, most natural treats in India.
            No preservatives. No additives. Just real food for real dogs.
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:24px 0;text-align:center">
            ${[
              { emoji: '🦴', title: '100% Natural', desc: 'Zero preservatives' },
              { emoji: '🇮🇳', title: 'Made in India', desc: 'Locally sourced' },
              { emoji: '❤️', title: 'Vet Approved', desc: 'Safe for all dogs' },
            ].map(f => `
              <div style="background:white;border-radius:12px;padding:16px">
                <div style="font-size:28px">${f.emoji}</div>
                <div style="font-weight:bold;color:#1a1008;font-size:13px;margin-top:6px">${f.title}</div>
                <div style="color:#9ca3af;font-size:11px;margin-top:2px">${f.desc}</div>
              </div>
            `).join('')}
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #c8973a;border-radius:16px;padding:24px;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Your welcome gift</p>
            <div style="font-size:32px;font-weight:800;color:#c8973a;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Use this code for 10% off your next order</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px;margin-top:8px">
            Shop Now 🛍️
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'winback',
    name: 'Win-Back Inactive Customers',
    emoji: '💔',
    color: '#ef4444',
    bg: '#fef2f2',
    description: 'Send to customers who haven\'t ordered in 60+ days',
    subject: '🐾 We miss you (and so does your pup\'s treat jar)!',
    previewText: 'It\'s been a while — come back for something special',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🐾</div>
          <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <div style="font-size:56px;margin-bottom:16px">💔</div>
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">We miss you, ${name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
            It's been a while since your pup had their favourite Game of Bones treats.
            We've been busy adding new flavours and sizes — come see what's new!
          </p>
          <div style="background:white;border-radius:16px;padding:24px;margin:24px 0;text-align:left">
            <p style="margin:0 0 16px;font-weight:bold;color:#1a1008">🆕 What's new at Game of Bones:</p>
            ${[
              '🐟 New Fish Treats — Omega-3 rich sardines and rohu',
              '🐐 Goat Organ Packs — Liver, kidney and heart mix',
              '🐔 Larger sizes — Now available in 280g and 400g',
              '📦 Free delivery on orders above ₹499',
            ].map(item => `<p style="margin:0 0 8px;color:#374151;font-size:14px">${item}</p>`).join('')}
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #ef4444;border-radius:16px;padding:24px;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Special come-back offer</p>
            <div style="font-size:32px;font-weight:800;color:#ef4444;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">15% off — valid for 48 hours only!</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#ef4444;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px;margin-top:8px">
            Come Back & Save 🎁
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale — 24 Hours Only',
    emoji: '⚡',
    color: '#f59e0b',
    bg: '#fefce8',
    description: 'Urgent 24-hour flash sale to drive quick orders',
    subject: '⚡ 24-HOUR FLASH SALE — Up to 30% off ends tonight!',
    previewText: 'Don\'t miss this — sale ends at midnight!',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">⚡</div>
          <h1 style="color:white;margin:0;font-size:32px;font-weight:900">FLASH SALE</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;font-weight:bold">24 HOURS ONLY</p>
        </div>
        <div style="background:#1a1008;padding:16px;text-align:center">
          <p style="color:#f59e0b;margin:0;font-size:18px;font-weight:bold">
            ⏰ Sale ends at MIDNIGHT tonight
          </p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <h2 style="color:#1a1008;margin:0 0 8px;font-size:22px">Hi ${name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">
            For the next 24 hours only, we're slashing prices on our most popular treats.
            Your pup deserves a treat — and so does your wallet!
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 32px">
            ${[
              { name: 'Chicken Jerky', original: '₹329', sale: '₹249', emoji: '🍗' },
              { name: 'Fish Treats',   original: '₹399', sale: '₹299', emoji: '🐟' },
              { name: 'Goat Organs',   original: '₹449', sale: '₹329', emoji: '🐐' },
              { name: 'Bone Bundle',   original: '₹599', sale: '₹429', emoji: '🦴' },
            ].map(p => `
              <div style="background:white;border-radius:12px;padding:16px;text-align:center;position:relative">
                <div style="background:#ef4444;color:white;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:50px;display:inline-block;margin-bottom:8px">SALE</div>
                <div style="font-size:32px">${p.emoji}</div>
                <div style="font-weight:bold;color:#1a1008;font-size:13px;margin:6px 0">${p.name}</div>
                <div style="color:#9ca3af;text-decoration:line-through;font-size:12px">${p.original}</div>
                <div style="color:#ef4444;font-weight:900;font-size:20px">${p.sale}</div>
              </div>
            `).join('')}
          </div>
          ${coupon ? `
          <div style="background:white;border:3px solid #f59e0b;border-radius:16px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Use code at checkout</p>
            <div style="font-size:36px;font-weight:900;color:#f59e0b;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Expires midnight tonight</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#f59e0b;color:#1a1008;padding:16px 40px;text-decoration:none;border-radius:50px;font-weight:900;display:inline-block;font-size:16px">
            ⚡ Shop the Sale Now
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'reorder',
    name: 'Reorder Reminder',
    emoji: '🔄',
    color: '#3b82f6',
    bg: '#eff6ff',
    description: 'Remind customers their treats are probably running low',
    subject: '🐾 Is your pup\'s treat jar running low?',
    previewText: 'Time to restock before they run out!',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🐾</div>
          <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <div style="font-size:56px;margin-bottom:16px">🔄</div>
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Time to restock, ${name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
            Based on your order history, your pup's treats are probably running low.
            Don't let the treat jar go empty — happy dogs need happy snacks!
          </p>
          <div style="background:white;border-radius:16px;padding:24px;margin:0 0 24px;text-align:left">
            <p style="margin:0 0 16px;font-weight:bold;color:#1a1008;font-size:15px">🦴 Why reorder now?</p>
            ${[
              '⚡ Fast delivery — 4 to 7 business days',
              '📦 Free delivery on orders above Rs 499',
              '🎁 Loyalty points on every order',
              '🐕 Your dog will love you for it',
            ].map(item => `<p style="margin:0 0 10px;color:#374151;font-size:14px">${item}</p>`).join('')}
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #3b82f6;border-radius:16px;padding:24px;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Reorder discount</p>
            <div style="font-size:32px;font-weight:800;color:#3b82f6;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">10% off your next order</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#3b82f6;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
            Restock Now 🛍️
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'new_product',
    name: 'New Product Launch',
    emoji: '🆕',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    description: 'Announce a new product to all customers',
    subject: '🆕 Just launched — your dog NEEDS to try this!',
    previewText: 'Something new and delicious just dropped at Game of Bones',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🆕</div>
          <h1 style="color:white;margin:0;font-size:28px;font-weight:800">Just Launched!</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Game of Bones</p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hi ${name}, something new is here!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">
            We've been working hard to bring you the best natural treats for your pup.
            And today, we're thrilled to announce our latest addition!
          </p>
          <div style="background:white;border-radius:20px;padding:32px;margin:0 0 24px;text-align:center;border:2px solid #8b5cf6">
            <div style="font-size:64px;margin-bottom:16px">🐟</div>
            <h3 style="color:#1a1008;margin:0 0 8px;font-size:22px">Ocean Fish Treats</h3>
            <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px">
              Wild-caught sardines and rohu, air-dried to perfection.
              Rich in Omega-3 for a shiny coat and healthy joints.
            </p>
            <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 0 16px">
              ${['Omega-3 Rich','Grain Free','Air Dried','Wild Caught'].map(t => `
                <span style="background:#f5f3ff;color:#8b5cf6;padding:4px 12px;border-radius:50px;font-size:12px;font-weight:600">${t}</span>
              `).join('')}
            </div>
            <div style="font-size:24px;font-weight:900;color:#8b5cf6">Starting at ₹299</div>
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #8b5cf6;border-radius:16px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Launch offer — first 100 orders</p>
            <div style="font-size:32px;font-weight:800;color:#8b5cf6;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">20% off on the new product</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#8b5cf6;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
            Try It Now 🆕
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'vip',
    name: 'VIP Customer Reward',
    emoji: '👑',
    color: '#c8973a',
    bg: '#fefce8',
    description: 'Reward your top customers with an exclusive offer',
    subject: '👑 You\'re a VIP — exclusive offer inside!',
    previewText: 'This offer is only for our most loyal customers',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#c8973a,#92400e);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">👑</div>
          <h1 style="color:white;margin:0;font-size:28px;font-weight:800">VIP Exclusive</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Game of Bones</p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <div style="background:white;border-radius:20px;padding:24px;margin:0 0 24px;border:2px solid #c8973a">
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px">This offer is exclusively for</p>
            <h2 style="color:#c8973a;margin:0;font-size:28px;font-weight:900">${name}</h2>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">One of our most valued customers 🐾</p>
          </div>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">
            You've been with us from the beginning. You're not just a customer —
            you're part of the Game of Bones family. And family gets special treatment.
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 24px">
            ${[
              { emoji: '🎁', title: 'Exclusive Discount', desc: '25% off everything' },
              { emoji: '🚀', title: 'Priority Dispatch', desc: 'Your order ships first' },
              { emoji: '👋', title: 'Early Access', desc: 'New products first' },
              { emoji: '💬', title: 'Direct Line', desc: 'WhatsApp us anytime' },
            ].map(f => `
              <div style="background:white;border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:28px">${f.emoji}</div>
                <div style="font-weight:bold;color:#1a1008;font-size:13px;margin-top:6px">${f.title}</div>
                <div style="color:#9ca3af;font-size:11px;margin-top:2px">${f.desc}</div>
              </div>
            `).join('')}
          </div>
          ${coupon ? `
          <div style="background:linear-gradient(135deg,#c8973a,#92400e);border-radius:16px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.8);font-size:13px">Your VIP code</p>
            <div style="font-size:36px;font-weight:900;color:white;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:12px">25% off — valid for 7 days</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
            Claim Your VIP Offer 👑
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'birthday',
    name: 'Dog Birthday Campaign',
    emoji: '🎂',
    color: '#ec4899',
    bg: '#fdf2f8',
    description: 'Send to customers whose dog has a birthday this month',
    subject: '🎂 Happy Birthday to your furry best friend!',
    previewText: 'A special birthday treat for the goodest boy/girl',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#ec4899,#be185d);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🎂</div>
          <h1 style="color:white;margin:0;font-size:28px;font-weight:800">Happy Birthday!</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">To the goodest boy/girl</p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hey ${name}! 🎉</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">
            We heard your pup has a birthday this month! Every dog deserves
            something special on their big day. Treat them to their favourite
            Game of Bones treats — because the goodest dogs deserve the best snacks!
          </p>
          <div style="background:white;border-radius:16px;padding:24px;margin:0 0 24px">
            <div style="font-size:48px;margin-bottom:12px">🐕</div>
            <p style="margin:0;color:#374151;font-size:15px;font-style:italic;line-height:1.7">
              "Every birthday is a reminder that your dog chose you.
              Celebrate with treats worthy of the occasion."
            </p>
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #ec4899;border-radius:16px;padding:24px;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Birthday gift from us 🎁</p>
            <div style="font-size:32px;font-weight:800;color:#ec4899;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">20% off — birthday month special</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#ec4899;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
            Get Birthday Treats 🎂
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
  {
    id: 'referral',
    name: 'Refer a Friend',
    emoji: '👥',
    color: '#06b6d4',
    bg: '#ecfeff',
    description: 'Ask happy customers to refer their friends',
    subject: '🐾 Share the love — get rewarded for every friend you refer!',
    previewText: 'You + your friend = treats for everyone',
    html: (name: string, coupon: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:linear-gradient(135deg,#06b6d4,#0891b2);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">👥</div>
          <h1 style="color:white;margin:0;font-size:28px;font-weight:800">Refer & Earn</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Game of Bones</p>
        </div>
        <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
          <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hey ${name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">
            You love Game of Bones. Your dog loves Game of Bones.
            Know another dog parent who deserves the best treats?
            Refer them and both of you get rewarded!
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 32px">
            <div style="background:white;border-radius:16px;padding:24px;text-align:center;border:2px solid #06b6d4">
              <div style="font-size:36px;margin-bottom:8px">🎁</div>
              <div style="font-weight:bold;color:#1a1008;font-size:15px">You Get</div>
              <div style="color:#06b6d4;font-weight:900;font-size:24px;margin:8px 0">₹100</div>
              <div style="color:#9ca3af;font-size:12px">store credit</div>
            </div>
            <div style="background:white;border-radius:16px;padding:24px;text-align:center;border:2px solid #06b6d4">
              <div style="font-size:36px;margin-bottom:8px">🐾</div>
              <div style="font-weight:bold;color:#1a1008;font-size:15px">Friend Gets</div>
              <div style="color:#06b6d4;font-weight:900;font-size:24px;margin:8px 0">10% OFF</div>
              <div style="color:#9ca3af;font-size:12px">first order</div>
            </div>
          </div>
          ${coupon ? `
          <div style="background:white;border:2px dashed #06b6d4;border-radius:16px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Your referral code — share this!</p>
            <div style="font-size:32px;font-weight:800;color:#06b6d4;letter-spacing:4px">${coupon}</div>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Ask your friend to use this at checkout</p>
          </div>` : ''}
          <a href="https://gameofbones.in" style="background:#06b6d4;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">
            Share with a Friend 👥
          </a>
        </div>
        <div style="background:#1a1008;padding:24px 32px;text-align:center">
          <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in · WhatsApp: +91 90825 03295</p>
        </div>
      </div>
    `
  },
]

export default function CampaignsPage() {
  const [customers, setCustomers]     = useState<any[]>([])
  const [orders, setOrders]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState<string | null>(null)
  const [preview, setPreview]         = useState<any>(null)
  const [msg, setMsg]                 = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [couponCode, setCouponCode]   = useState('')
  const [segment, setSegment]         = useState('all')
  const [customSubject, setCustomSubject] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [cust, ords] = await Promise.all([
      supabase.from('customers').select('*').not('email', 'is', null),
      supabase.from('orders').select('customer_phone, created_at, grand_total').order('created_at', { ascending: false }),
    ])
    setCustomers(cust.data || [])
    setOrders(ords.data || [])
    setLoading(false)
  }

  function getSegmentCustomers(segmentKey: string) {
    switch (segmentKey) {
      case 'all':
        return customers
      case 'new':
        return customers.filter(c => c.total_orders === 1)
      case 'repeat':
        return customers.filter(c => c.total_orders > 1)
      case 'vip':
        return customers.filter(c => c.total_spent >= 5000)
      case 'inactive': {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
        return customers.filter(c => {
          const lastOrder = orders.filter(o => o.customer_phone === c.phone)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          if (!lastOrder) return false
          return new Date(lastOrder.created_at) < sixtyDaysAgo
        })
      }
      default:
        return customers
    }
  }

  async function sendCampaign(campaign: any) {
    const targetCustomers = getSegmentCustomers(segment)
    if (targetCustomers.length === 0) {
      setMsg('❌ No customers in this segment')
      return
    }
    setSending(campaign.id)
    setMsg('')

    try {
      const res = await fetch('/api/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: targetCustomers,
          campaign: {
            type:        campaign.id,
            subject:     customSubject || campaign.subject,
            headline:    campaign.name,
            body:        '',
            cta:         'Shop Now',
            coupon:      couponCode,
            htmlTemplate: campaign.html('{{name}}', couponCode),
            useHtml:     true,
          }
        })
      })
      const data = await res.json()
      setMsg(`✅ ${campaign.name} sent to ${data.sent || targetCustomers.length} customers!`)
      setSelectedCampaign(null)
      setCouponCode('')
      setCustomSubject('')
    } catch {
      setMsg('❌ Failed to send campaign')
    }
    setSending(null)
    setTimeout(() => setMsg(''), 5000)
  }

  const segmentCounts = {
    all:      customers.length,
    new:      customers.filter(c => c.total_orders === 1).length,
    repeat:   customers.filter(c => c.total_orders > 1).length,
    vip:      customers.filter(c => c.total_spent >= 5000).length,
    inactive: getSegmentCustomers('inactive').length,
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Campaigns', href: '/campaigns' },
            { label: 'Campaigns+', href: '/campaigns-hub' },
            { label: 'Marketing', href: '/marketing' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Email Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Pre-written campaigns with beautiful designs — one click to send
          </p>
        </div>

        {msg && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm"
            style={{
              background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
              color: msg.startsWith('✅') ? '#166534' : '#ef4444',
              border: `1px solid ${msg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`
            }}>
            {msg}
          </div>
        )}

        {/* Segment selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#374151' }}>
            Target Segment
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'All Customers' },
              { key: 'new',      label: 'New (1 order)' },
              { key: 'repeat',   label: 'Repeat Buyers' },
              { key: 'vip',      label: 'VIP (₹5000+)' },
              { key: 'inactive', label: 'Inactive 60d+' },
            ].map(s => (
              <button key={s.key} onClick={() => setSegment(s.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: segment === s.key ? '#1a1008' : '#f9fafb',
                  color: segment === s.key ? 'white' : '#374151',
                  border: '1px solid #e5e7eb'
                }}>
                {s.label}
                <span className="ml-2 text-xs opacity-70">
                  ({segmentCounts[s.key as keyof typeof segmentCounts]})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Campaign cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CAMPAIGNS.map(campaign => (
            <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5" style={{ background: campaign.bg }}>
                <div style={{ fontSize: 40 }}>{campaign.emoji}</div>
                <div className="font-bold mt-2 text-sm" style={{ color: '#1a1008' }}>
                  {campaign.name}
                </div>
                <div className="text-xs mt-1" style={{ color: '#6b7280', lineHeight: 1.5 }}>
                  {campaign.description}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs mb-3" style={{ color: '#9ca3af' }}>
                  📧 {campaign.subject.slice(0, 45)}...
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreview(campaign)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#f3f4f6', color: '#374151' }}>
                    👁️ Preview
                  </button>
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                    style={{ background: campaign.color }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-bold" style={{ color: '#111827' }}>
                {preview.emoji} {preview.name} — Preview
              </div>
              <button onClick={() => setPreview(null)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Subject Line</div>
              <div className="text-sm mb-4 p-3 rounded-lg" style={{ background: '#f9fafb', color: '#374151' }}>
                {preview.subject}
              </div>
              <div className="text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>Email Preview</div>
              <div className="rounded-xl overflow-hidden border border-gray-200"
                dangerouslySetInnerHTML={{ __html: preview.html('Rahul', 'PREVIEW10') }}
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setPreview(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#f3f4f6', color: '#374151' }}>
                Close
              </button>
              <button
                onClick={() => { setPreview(null); setSelectedCampaign(preview) }}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: preview.color }}>
                Send This Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>
                {selectedCampaign.emoji} Send Campaign
              </div>
              <button onClick={() => setSelectedCampaign(null)}
                className="text-2xl font-light" style={{ color: '#9ca3af' }}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl" style={{ background: selectedCampaign.bg }}>
                <div className="font-bold" style={{ color: '#1a1008' }}>{selectedCampaign.name}</div>
                <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{selectedCampaign.description}</div>
              </div>

              <div className="p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="text-xs font-semibold" style={{ color: '#166534' }}>
                  📨 Sending to {getSegmentCustomers(segment).length} customers
                  ({segment === 'all' ? 'All' : segment} segment)
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                  Coupon Code (optional)
                </label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                  style={{ color: '#111827' }}
                />
                <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                  This code will appear in the email. Make sure it exists in Coupons first.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                  Custom Subject (optional)
                </label>
                <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                  placeholder={selectedCampaign.subject}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedCampaign(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: '#f3f4f6', color: '#374151' }}>
                  Cancel
                </button>
                <button
                  onClick={() => sendCampaign(selectedCampaign)}
                  disabled={sending === selectedCampaign.id || loading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: selectedCampaign.color }}>
                  {sending === selectedCampaign.id
                    ? 'Sending...'
                    : `Send to ${getSegmentCustomers(segment).length} customers`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
