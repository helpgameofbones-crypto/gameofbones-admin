import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JWT } from 'google-auth-library'
import { revealLegacyPii, revealLegacyPiiValue } from '@/app/lib/pii-crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Daily cron (see vercel.json -> /api/sheets-sync) writes the full order log and
// current stock levels into the owner's Google Sheet via a service account, so the
// sheet stays in sync automatically without anyone exporting/pasting a CSV.
const SHEET_ID = '1XYL7ucovkfGr-9Ry-kVYm1j2Lv22ed-0akMEhz-iyYA'
const ORDERS_TAB = 'Sales & Orders Log'
const STOCK_TAB = 'Stock Levels'
const ORDERS_START_ROW = 11 // matches the tab's own documented paste-start row

// Order items are saved with a `quantity` key and `product_name`, not `qty`/`name`
// for website checkouts, but manual admin orders use `quantity`/`name`. Handle both.
function itemQty(i: any): number {
  return i?.quantity ?? i?.qty ?? 1
}
function itemName(i: any): string {
  return i?.name ?? i?.product_name ?? ''
}
function itemLabel(i: any): string {
  const label = i?.pack_label
  return label ? `${itemQty(i)}x ${itemName(i)} (${label})` : `${itemQty(i)}x ${itemName(i)}`
}
function paymentLabel(method: string): string {
  const m = (method || '').toLowerCase()
  if (m === 'cod') return 'COD'
  if (m === 'razorpay' || m === 'upi') return 'Prepaid'
  if (m === 'cash') return 'Cash'
  if (m === 'gift') return 'Gift'
  return method || ''
}
function titleCase(s: string): string {
  return (s || '').replace(/^\w/, c => c.toUpperCase())
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set in environment')
  }
  const key = rawKey.replace(/\\n/g, '\n')
  const client = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
  const token = await client.authorize()
  if (!token.access_token) throw new Error('Failed to obtain Google access token')
  return token.access_token
}

async function sheetsApi(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets API ${path} failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accessToken = await getAccessToken()

    // ---------- Orders -> "Sales & Orders Log" tab ----------
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: true })
    if (ordersErr) throw ordersErr
    const orderList = orders || []

    const orderRows = orderList.map(o => [
      o.ref,
      new Date(o.created_at).toLocaleDateString('en-IN'),
      revealLegacyPii(o.customer_name),
      revealLegacyPii(o.customer_phone),
      revealLegacyPii(o.customer_email),
      String(revealLegacyPiiValue(o.shipping_address?.street || '')),
      o.shipping_address?.city || '',
      o.shipping_address?.state || '',
      o.shipping_address?.pincode || '',
      (o.items || []).map(itemLabel).join(' | '),
      Number(o.grand_total) || 0,
      paymentLabel(o.payment_method),
      titleCase(o.status || ''),
      o.delhivery_awb || '',
    ])

    // Idempotent full refresh: clear the old range, then write the current data.
    // Only touches columns A-N -- the sheet's own Est. COGS / Est. Gross Profit
    // formula columns (O onward) are left completely alone.
    await sheetsApi(accessToken, `/values/'${ORDERS_TAB}'!A${ORDERS_START_ROW}:N5000:clear`, {
      method: 'POST',
      body: '{}',
    })
    if (orderRows.length) {
      const endRow = ORDERS_START_ROW + orderRows.length - 1
      await sheetsApi(
        accessToken,
        `/values/'${ORDERS_TAB}'!A${ORDERS_START_ROW}:N${endRow}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          body: JSON.stringify({
            range: `'${ORDERS_TAB}'!A${ORDERS_START_ROW}:N${endRow}`,
            values: orderRows,
          }),
        }
      )
    }

    // ---------- Stock -> "Stock Levels" tab (created if missing) ----------
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('name, stock, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (productsErr) throw productsErr

    const unitsSoldByProduct: Record<string, number> = {}
    for (const o of orderList) {
      for (const item of (o.items || [])) {
        const name = itemName(item)
        if (!name) continue
        unitsSoldByProduct[name] = (unitsSoldByProduct[name] || 0) + itemQty(item)
      }
    }

    const meta = await sheetsApi(accessToken, '')
    const hasStockTab = (meta.sheets || []).some((s: any) => s.properties?.title === STOCK_TAB)
    if (!hasStockTab) {
      await sheetsApi(accessToken, ':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: STOCK_TAB } } }] }),
      })
    }

    const stockHeader = ['Product', 'Current Stock (admin)', 'Units Sold (all-time)', 'Last Synced']
    const stockRows = (products || []).map(p => [
      p.name,
      p.stock ?? 0,
      unitsSoldByProduct[p.name] || 0,
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    ])
    const stockValues = [stockHeader, ...stockRows]

    await sheetsApi(accessToken, `/values/'${STOCK_TAB}'!A1:D5000:clear`, { method: 'POST', body: '{}' })
    await sheetsApi(
      accessToken,
      `/values/'${STOCK_TAB}'!A1:D${stockValues.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ range: `'${STOCK_TAB}'!A1:D${stockValues.length}`, values: stockValues }),
      }
    )

    return NextResponse.json({
      ok: true,
      ordersSynced: orderRows.length,
      productsSynced: stockRows.length,
      syncedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[sheets-sync] error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
