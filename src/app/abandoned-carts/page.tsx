'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchCarts() }, [])

  async function fetchCarts() {
    const { data } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('event_type', 'add_to_cart')
      .order('created_at', { ascending: false })
    const hourAgo = new Date(Date.now() - 3600000)
    const map: Record<string, any> = {}
    for (const e of (data || [])) {
      if (!map[e.visitor_id] || new Date(e.created_at) > new Date(map[e.visitor_id].created_at)) {
        map[e.visitor_id] = e
      }
    }
    setCarts(Object.values(map).filter(c => new Date(c.created_at) < hourAgo))
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f9f6f2' }}>
      <div style={{ background:'#1a1008', padding:'16px 24px' }}>
        <div style={{ color:'#c8973a', fontWeight:'bold', fontSize:18 }}>Game of Bones Admin</div>
      </div>
      <div style={{ padding:24 }}>
        <h1 style={{ fontSize:24, fontWeight:'bold', color:'#111827', marginBottom:8 }}>Abandoned Carts</h1>
        <p style={{ fontSize:14, color:'#6b7280', marginBottom:24 }}>Customers who added to cart but did not complete their order</p>
        <div style={{ background:'white', borderRadius:12, border:'1px solid #f3f4f6', overflow:'hidden' }}>
          <table style={{ width:'100%', fontSize:14, borderCollapse:'collapse' }}>
            <thead style={{ background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
              <tr>
                <th style={{ textAlign:'left', padding:'12px 16px', color:'#6b7280' }}>Visitor</th>
                <th style={{ textAlign:'left', padding:'12px 16px', color:'#6b7280' }}>Product</th>
                <th style={{ textAlign:'left', padding:'12px 16px', color:'#6b7280' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Loading...</td></tr>
              ) : carts.length === 0 ? (
                <tr><td colSpan={3} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>No abandoned carts yet</td></tr>
              ) : carts.map((cart) => (
                <tr key={cart.visitor_id}>
                  <td style={{ padding:'12px 16px', color:'#6b7280' }}>{String(cart.visitor_id).slice(0,12)}</td>
                  <td style={{ padding:'12px 16px', color:'#111827' }}>{cart.product_name || 'Unknown'}</td>
                  <td style={{ padding:'12px 16px', color:'#6b7280' }}>{new Date(cart.created_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}



