'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchInventory() }, [])

  async function fetchInventory() {
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('stock', { ascending: true })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: orders } = await supabase
      .from('orders')
      .select('items, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'delivered')

    const salesMap: Record<string, number> = {}
    ;(orders || []).forEach(o => {
      ;(o.items || []).forEach((item: any) => {
        salesMap[item.name] = (salesMap[item.name] || 0) + item.qty
      })
    })

    const enriched = (prods || []).map(p => {
      const monthlySales = salesMap[p.name] || 0
      const dailySales   = monthlySales / 30
      const daysLeft     = dailySales > 0 ? Math.round(p.stock / dailySales) : null
      const reorderQty   = Math.max(monthlySales * 2, 20)
      return { ...p, monthlySales, dailySales, daysLeft, reorderQty }
    })

    setProducts(enriched)
    setLoading(false)
  }

  async function updateStock(id: string, stock: number) {
    await supabase.from('products').update({ stock }).eq('id', id)
    fetchInventory()
  }

  const navLinks = [
    { label: 'Dashboard',  href: '/dashboard' },
    { label: 'Orders',     href: '/orders' },
    { label: 'Products',   href: '/products' },
    { label: 'Customers',  href: '/customers' },
    { label: 'Inventory',  href: '/inventory' },
    { label: 'Analytics',  href: '/analytics' },
    { label: 'RTO Risk',   href: '/rto' },
  ]

  const critical = products.filter(p => p.stock === 0).length
  const low      = products.filter(p => p.stock > 0 && p.stock < 10).length
  const healthy  = products.filter(p => p.stock >= 10).length

  return (
    <div className="min-h-screen" style={{ background: '#f9f6f2' }}>
      <div className="text-white px-6 py-4 flex items-center justify-between"
        style={{ background: '#1a1008' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">ðŸ¾</span>
          <div>
            <div className="font-bold text-lg" style={{ color: '#c8973a' }}>Game of Bones</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {navLinks.map(item => (
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
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Inventory Forecast</h1>
          <p className="text-sm mt-1" style={{ color: '#1a1008' }}>
            Stock levels and reorder predictions based on last 30 days sales
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Out of Stock',  value: critical, icon: 'ðŸ”´', color: '#ef4444' },
            { label: 'Low Stock',     value: low,      icon: 'ðŸŸ¡', color: '#f59e0b' },
            { label: 'Healthy Stock', value: healthy,  icon: 'ðŸŸ¢', color: '#10b981' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#1a1008' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Product','Current Stock','Monthly Sales','Days Left','Reorder Qty','Status','Update Stock'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: '#1a1008' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#2a1f1a' }}>Loading...</td></tr>
              ) : products.map(product => {
                const isOut      = product.stock === 0
                const isLow      = product.stock > 0 && product.stock < 10
                const statusColor = isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'
                const statusBg    = isOut ? '#fef2f2' : isLow ? '#fefce8' : '#f0fdf4'
                const statusLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy'

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#111827' }}>{product.name}</div>
                      <div className="text-xs" style={{ color: '#2a1f1a' }}>{product.sku}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-xl"
                      style={{ color: statusColor }}>
                      {product.stock}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#1a1008' }}>
                      {product.monthlySales} units
                    </td>
                    <td className="px-4 py-3">
                      {product.daysLeft !== null ? (
                        <span className="font-bold" style={{ color: product.daysLeft < 7 ? '#ef4444' : '#111827' }}>
                          {product.daysLeft} days
                        </span>
                      ) : (
                        <span style={{ color: '#2a1f1a' }}>No sales data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#1a1008' }}>
                      {Math.round(product.reorderQty)} units
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: statusBg, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={product.stock}
                          onBlur={e => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && val !== product.stock) {
                              updateStock(product.id, val)
                            }
                          }}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                          style={{ color: '#111827' }}
                        />
                        <span className="text-xs" style={{ color: '#2a1f1a' }}>units</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}