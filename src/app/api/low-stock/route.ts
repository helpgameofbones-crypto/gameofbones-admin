import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/app/lib/emailClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .lt('stock', 10)
    .eq('is_active', true)
    .order('stock', { ascending: true })

  const lowStock = products || []

  if (lowStock.length === 0) {
    return NextResponse.json({ ok: true, message: 'All stock levels healthy' })
  }

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'helpgameofbones@gmail.com',
    subject: `âš ï¸ Low Stock Alert â€” ${lowStock.length} products need restocking`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1008;padding:24px;text-align:center">
          <h1 style="color:#c8973a;margin:0">ðŸ¾ Game of Bones</h1>
          <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:14px">Low Stock Alert</p>
        </div>

        <div style="background:#f9f6f2;padding:24px">
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:16px;margin-bottom:20px">
            <p style="margin:0;font-size:14px;color:#92400e">
              âš ï¸ <strong>${lowStock.length} product${lowStock.length > 1 ? 's' : ''}</strong> 
              ${lowStock.length > 1 ? 'are' : 'is'} running low on stock. Please restock soon.
            </p>
          </div>

          <div style="background:white;border-radius:12px;overflow:hidden;margin-bottom:20px">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <thead>
                <tr style="background:#f9fafb;border-bottom:1px solid #f3f4f6">
                  <th style="text-align:left;padding:12px 16px;color:#6b7280;font-size:11px;text-transform:uppercase">Product</th>
                  <th style="text-align:left;padding:12px 16px;color:#6b7280;font-size:11px;text-transform:uppercase">SKU</th>
                  <th style="text-align:center;padding:12px 16px;color:#6b7280;font-size:11px;text-transform:uppercase">Stock Left</th>
                  <th style="text-align:left;padding:12px 16px;color:#6b7280;font-size:11px;text-transform:uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                ${lowStock.map(p => `
                  <tr style="border-bottom:1px solid #f3f4f6">
                    <td style="padding:12px 16px;font-weight:600;color:#111827">${p.name}</td>
                    <td style="padding:12px 16px;font-family:monospace;font-size:12px;color:#6b7280">${p.sku || 'â€”'}</td>
                    <td style="padding:12px 16px;text-align:center">
                      <span style="font-weight:bold;font-size:18px;color:${p.stock === 0 ? '#ef4444' : p.stock <= 3 ? '#f59e0b' : '#111827'}">
                        ${p.stock}
                      </span>
                    </td>
                    <td style="padding:12px 16px">
                      <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;
                        background:${p.stock === 0 ? '#fef2f2' : '#fef3c7'};
                        color:${p.stock === 0 ? '#ef4444' : '#92400e'}">
                        ${p.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="text-align:center">
            <a href="https://gameofbones-admin.vercel.app/products"
              style="background:#1a1008;color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">
              Update Stock Levels â†’
            </a>
          </div>
        </div>

        <div style="background:#1a1008;padding:16px;text-align:center">
          <p style="color:rgba(255,255,255,0.4);margin:0;font-size:12px">
            Game of Bones Â· This alert runs automatically every morning at 9 AM
          </p>
        </div>
      </div>
    `
  })

  return NextResponse.json({
    ok: true,
    low_stock_count: lowStock.length,
    products: lowStock.map(p => ({ name: p.name, stock: p.stock }))
  })
}