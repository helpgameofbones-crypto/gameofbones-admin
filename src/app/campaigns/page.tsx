'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">We heard your pup has a birthday this month! Every dog deserves something special on their big day. Treat them to their favourite Game of Bones treats!</p>
        <div style="background:white;border-radius:16px;padding:24px;margin:0 auto 24px;max-width:400px">
          <div style="font-size:48px;margin-bottom:12px">&#128054;</div>
          <p style="margin:0;color:#374151;font-size:15px;font-style:italic;line-height:1.7">Every birthday is a reminder that your dog chose you. Celebrate with treats worthy of the occasion.</p>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #ec4899;border-radius:16px;padding:24px;margin:24px auto;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Birthday gift from us</p><div style="font-size:32px;font-weight:800;color:#ec4899;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">20% off - birthday month special</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#ec4899;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Get Birthday Treats</a>
      </div>`,
    referral: `
      <div style="text-align:center;padding:40px 32px;background:#f9f6f2">
        <div style="font-size:56px;margin-bottom:16px">&#128101;</div>
        <h2 style="color:#1a1008;margin:0 0 12px;font-size:24px">Hey ${name}!</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 32px">You love Game of Bones. Your dog loves Game of Bones. Know another dog parent who deserves the best treats? Refer them and both of you get rewarded!</p>
        <div style="display:flex;justify-content:center;gap:12px;margin:0 0 32px;flex-wrap:wrap">
          <div style="background:white;border-radius:16px;padding:24px;min-width:160px;text-align:center;border:2px solid #06b6d4"><div style="font-size:36px;margin-bottom:8px">&#127873;</div><div style="font-weight:bold;color:#1a1008;font-size:15px">You Get</div><div style="color:#06b6d4;font-weight:900;font-size:24px;margin:8px 0">Rs 100</div><div style="color:#9ca3af;font-size:12px">store credit</div></div>
          <div style="background:white;border-radius:16px;padding:24px;min-width:160px;text-align:center;border:2px solid #06b6d4"><div style="font-size:36px;margin-bottom:8px">&#128062;</div><div style="font-weight:bold;color:#1a1008;font-size:15px">Friend Gets</div><div style="color:#06b6d4;font-weight:900;font-size:24px;margin:8px 0">10% OFF</div><div style="color:#9ca3af;font-size:12px">first order</div></div>
        </div>
        ${coupon ? `<div style="background:white;border:2px dashed #06b6d4;border-radius:16px;padding:24px;margin:0 auto 24px;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Your referral code - share this!</p><div style="font-size:32px;font-weight:800;color:#06b6d4;letter-spacing:4px">${coupon}</div><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Ask your friend to use this at checkout</p></div>` : ''}
        <a href="https://gameofbones.in" style="background:#06b6d4;color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block;font-size:15px">Share with a Friend</a>
      </div>`,
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
      <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
        <img src="${LOGO}" alt="Game of Bones" style="height:80px;width:auto;margin-bottom:12px;border-radius:12px;display:block;margin-left:auto;margin-right:auto" />
        <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">Premium Natural Dehydrated Treats for Happy Dogs</p>
      </div>
      ${bodies[campaign.id] || bodies.welcome}
      <div style="background:#1a1008;padding:24px 32px;text-align:center">
        <p style="color:#c8973a;margin:0 0 8px;font-weight:bold">Game of Bones</p>
        <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">gameofbones.in - WhatsApp: +91 90825 03295</p>
      </div>
    </div>
  `
}

export default function CampaignsPage() {
  const [customers, setCustomers]   = useState<any[]>([])
  const [orders, setOrders]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState<string | null>(null)
  const [preview, setPreview]       = useState<any>(null)
  const [msg, setMsg]               = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [couponCode, setCouponCode] = useState('')
  const [segment, setSegment]       = useState('all')
  const [customSubject, setCustomSubject] = useState('')
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
    name: '', subject: '', body: '', coupon: '', segment: 'all'
  })

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
      case 'all':      return customers
      case 'new':      return customers.filter(c => c.total_orders === 1)
      case 'repeat':   return customers.filter(c => c.total_orders > 1)
      case 'vip':      return customers.filter(c => c.total_spent >= 5000)
      case 'inactive': {
        const d = new Date(Date.now() - 60 * 86400000)
        return customers.filter(c => {
          const last = orders.filter(o => o.customer_phone === c.phone)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          return last && new Date(last.created_at) < d
        })
      }
      default: return customers
    }
  }

  async function sendCampaign(campaign: any) {
    const target = getSegmentCustomers(segment)
    if (!target.length) { setMsg('No customers in this segment'); return }
    setSending(campaign.id)
    setMsg('')
    try {
      const res = await fetch('/api/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: target,
          campaign: {
            type:         campaign.id,
            subject:      customSubject || campaign.subject,
            headline:     campaign.name,
            body:         '',
            cta:          'Shop Now',
            coupon:       couponCode,
            htmlTemplate: buildHtml('{{name}}', campaign, couponCode),
            useHtml:      true,
          }
        })
      })
      const data = await res.json()
      setMsg('Sent ' + campaign.name + ' to ' + (data.sent || target.length) + ' customers!')
      setSelectedCampaign(null)
      setCouponCode('')
      setCustomSubject('')
    } catch {
      setMsg('Failed to send campaign')
    }
    setSending(null)
    setTimeout(() => setMsg(''), 5000)
  }

  async function sendCustomCampaign() {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.body) {
      setMsg('Please fill in name, subject and body')
      return
    }
    const target = getSegmentCustomers(newCampaign.segment)
    setSending('custom')
    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1a1008,#3d2314);padding:40px 32px;text-align:center">
            <img src="${LOGO}" alt="Game of Bones" style="height:80px;width:auto;margin-bottom:12px;border-radius:12px;display:block;margin-left:auto;margin-right:auto" />
            <h1 style="color:#c8973a;margin:0;font-size:28px;font-weight:800">Game of Bones</h1>
            <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">Premium Natural Dehydrated Treats for Happy Dogs</p>
          </div>
          <div style="background:#f9f6f2;padding:40px 32px;text-align:center">
            <h2 style="color:#1a1008;margin:0 0 16px">${newCampaign.name}</h2>
            <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 24px">Hi {{name}}! ${newCampaign.body}</p>
            ${newCampaign.coupon ? `<div style="background:white;border:2px dashed #c8973a;border-radius:16px;padding:20px;margin:0 auto 24px;max-width:300px"><p style="margin:0 0 8px;color:#6b7280;font-size:13px">Use code at checkout</p><div style="font-size:28px;font-weight:800;color:#c8973a;letter-spacing:4px">${newCampaign.coupon}</div></div>` : ''}
            <a href="https://gameofbones.in" style="background:#c8973a;color:#1a1008;padding:14px 32px;text-decoration:none;border-radius:50px;font-weight:800;display:inline-block">Shop Now</a>
          </div>
          <div style="background:#1a1008;padding:16px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">Game of Bones - gameofbones.in</p>
          </div>
        </div>
      `
      const res = await fetch('/api/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: target,
          campaign: {
            type: 'custom', subject: newCampaign.subject,
            headline: newCampaign.name, body: newCampaign.body,
            cta: 'Shop Now', coupon: newCampaign.coupon,
            htmlTemplate: html, useHtml: true,
          }
        })
      })
      const data = await res.json()
      setMsg('Custom campaign sent to ' + (data.sent || target.length) + ' customers!')
      setShowAddCampaign(false)
      setNewCampaign({ name: '', subject: '', body: '', coupon: '', segment: 'all' })
    } catch {
      setMsg('Failed to send campaign')
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
      <div className="text-white px-6 py-4 flex items-center justify-between" style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Game of Bones" style={{ height: 40, borderRadius: 8 }} />
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {[
            { label: 'Dashboard',  href: '/dashboard' },
            { label: 'Campaigns',  href: '/campaigns' },
            { label: 'Campaigns+', href: '/campaigns-hub' },
            { label: 'Marketing',  href: '/marketing' },
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Email Campaigns</h1>
            <p className="text-sm mt-1" style={{ color: '#1a1008' }}>Pre-written campaigns with beautiful designs - one click to send</p>
          </div>
          <button onClick={() => setShowAddCampaign(true)}
            className="text-white text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: '#c8973a' }}>
            + New Campaign
          </button>
        </div>

        {msg && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm"
            style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            {msg}
          </div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#1a1008' }}>Target Segment</div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'All Customers' },
              { key: 'new',      label: 'New (1 order)' },
              { key: 'repeat',   label: 'Repeat Buyers' },
              { key: 'vip',      label: 'VIP (Rs5000+)' },
              { key: 'inactive', label: 'Inactive 60d+' },
            ].map(s => (
              <button key={s.key} onClick={() => setSegment(s.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: segment === s.key ? '#1a1008' : '#f9fafb',
                  color: segment === s.key ? 'white' : '#374151',
                  border: '1px solid #e5e7eb'
                }}>
                {s.label} ({segmentCounts[s.key as keyof typeof segmentCounts]})
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CAMPAIGNS.map(campaign => (
            <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5" style={{ background: campaign.bg }}>
                <div style={{ fontSize: 40 }} dangerouslySetInnerHTML={{ __html: campaign.emoji }} />
                <div className="font-bold mt-2 text-sm" style={{ color: '#1a1008' }}>{campaign.name}</div>
                <div className="text-xs mt-1" style={{ color: '#1a1008', lineHeight: 1.5 }}>{campaign.description}</div>
              </div>
              <div className="p-4">
                <div className="text-xs mb-3" style={{ color: '#2a1f1a' }}>Subject: {campaign.subject.slice(0, 40)}...</div>
                <div className="flex gap-2">
                  <button onClick={() => setPreview(campaign)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: '#f3f4f6', color: '#1a1008' }}>
                    Preview
                  </button>
                  <button onClick={() => setSelectedCampaign(campaign)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-bold" style={{ color: '#111827' }}>{preview.name} - Preview</div>
              <button onClick={() => setPreview(null)} className="text-2xl font-light" style={{ color: '#2a1f1a' }}>x</button>
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Subject Line</div>
              <div className="text-sm mb-4 p-3 rounded-lg" style={{ background: '#f9fafb', color: '#1a1008' }}>{preview.subject}</div>
              <div className="text-xs font-semibold mb-2" style={{ color: '#1a1008' }}>Email Preview</div>
              <div className="rounded-xl overflow-hidden border border-gray-200"
                dangerouslySetInnerHTML={{ __html: buildHtml('Rahul', preview, 'PREVIEW10') }} />
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setPreview(null)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: '#f3f4f6', color: '#1a1008' }}>Close</button>
              <button onClick={() => { setPreview(null); setSelectedCampaign(preview) }}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: preview.color }}>
                Send This Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>Send Campaign</div>
              <button onClick={() => setSelectedCampaign(null)} className="text-2xl font-light" style={{ color: '#2a1f1a' }}>x</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl" style={{ background: selectedCampaign.bg }}>
                <div className="font-bold" style={{ color: '#1a1008' }}>{selectedCampaign.name}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="text-xs font-semibold" style={{ color: '#166534' }}>
                  Sending to {getSegmentCustomers(segment).length} customers ({segment} segment)
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Coupon Code (optional)</label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Custom Subject (optional)</label>
                <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                  placeholder={selectedCampaign.subject}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedCampaign(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#f3f4f6', color: '#1a1008' }}>Cancel</button>
                <button onClick={() => sendCampaign(selectedCampaign)}
                  disabled={sending === selectedCampaign.id}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: selectedCampaign.color }}>
                  {sending === selectedCampaign.id ? 'Sending...' : 'Send to ' + getSegmentCustomers(segment).length + ' customers'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Campaign Modal */}
      {showAddCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg" style={{ color: '#111827' }}>New Custom Campaign</div>
              <button onClick={() => setShowAddCampaign(false)} className="text-2xl font-light" style={{ color: '#2a1f1a' }}>x</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Campaign Name *</label>
                <input value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Summer Sale Announcement"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Email Subject *</label>
                <input value={newCampaign.subject} onChange={e => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  placeholder="Big summer sale - up to 25% off!"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Message Body *</label>
                <textarea value={newCampaign.body} onChange={e => setNewCampaign({ ...newCampaign, body: e.target.value })}
                  placeholder="Write your message here. It will appear in the email body after Hi [customer name]!"
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Coupon Code (optional)</label>
                <input value={newCampaign.coupon} onChange={e => setNewCampaign({ ...newCampaign, coupon: e.target.value.toUpperCase() })}
                  placeholder="SUMMER25"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1008' }}>Target Segment</label>
                <select value={newCampaign.segment} onChange={e => setNewCampaign({ ...newCampaign, segment: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ color: '#111827' }}>
                  <option value="all">All customers ({customers.length})</option>
                  <option value="new">New customers</option>
                  <option value="repeat">Repeat buyers</option>
                  <option value="vip">VIP customers</option>
                  <option value="inactive">Inactive 60d+</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddCampaign(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#f3f4f6', color: '#1a1008' }}>Cancel</button>
                <button onClick={sendCustomCampaign} disabled={sending === 'custom'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#c8973a' }}>
                  {sending === 'custom' ? 'Sending...' : 'Send Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}