import { NextRequest, NextResponse } from 'next/server'
import { encryptPii } from '@/app/lib/pii-crypto'
import { db, phoneHashOf, validSignature } from '@/app/lib/whatsapp'

/**
 * Meta WhatsApp webhook.
 * Callback URL:  https://gameofbones-admin.vercel.app/api/whatsapp/webhook
 * Verify token:  the value of WHATSAPP_VERIFY_TOKEN
 * Subscribe to the "messages" field.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 }
const STOP_WORDS = /^\s*(stop|unsubscribe|stop all|opt out|optout|cancel)\s*[.!]*\s*$/i
const START_WORDS = /^\s*(start|subscribe|unstop)\s*[.!]*\s*$/i

type WaStatus = { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] }
type WaMessage = { id: string; from: string; type: string; timestamp?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }
type WaContact = { wa_id?: string; profile?: { name?: string } }

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) return new NextResponse('Invalid signature', { status: 401 })
  let payload: { entry?: { changes?: { field?: string; value?: { statuses?: WaStatus[]; messages?: WaMessage[]; contacts?: WaContact[] } }[] }[] }
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {}
        for (const st of value.statuses || []) {
          const { data: row } = await db.from('whatsapp_messages').select('id,status').eq('wamid', st.id).maybeSingle()
          if (!row) continue
          if ((STATUS_RANK[st.status] || 0) <= (STATUS_RANK[row.status] || 0) && st.status !== 'failed') continue
          const err = st.errors?.[0]
          await db.from('whatsapp_messages').update({
            status: st.status,
            status_at: st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString(),
            ...(err ? { error: [err.title, err.message, err.error_data?.details].filter(Boolean).join(' — ').slice(0, 500) } : {}),
          }).eq('id', row.id)
        }
        const names = new Map((value.contacts || []).map(c => [c.wa_id || '', c.profile?.name || '']))
        for (const msg of value.messages || []) {
          const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || `[${msg.type}]`
          const local = msg.from.startsWith('91') ? msg.from.slice(2) : msg.from
          const hash = phoneHashOf(local)
          await db.from('whatsapp_inbound').upsert({
            wamid: msg.id,
            created_at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
            phone_hash: hash,
            phone_ciphertext: encryptPii(local),
            name_ciphertext: encryptPii(names.get(msg.from) || ''),
            body_ciphertext: encryptPii(text.slice(0, 4000)),
            msg_type: msg.type,
          }, { onConflict: 'wamid', ignoreDuplicates: true })
          if (hash && STOP_WORDS.test(text)) await db.from('whatsapp_optouts').upsert({ phone_hash: hash, reason: 'Replied STOP' })
          if (hash && START_WORDS.test(text)) await db.from('whatsapp_optouts').delete().eq('phone_hash', hash)
        }
      }
    }
    await db.from('whatsapp_settings').update({ last_webhook_at: new Date().toISOString() }).eq('id', 1)
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
  }
  // Always 200 so Meta does not keep retrying.
  return NextResponse.json({ ok: true })
}
