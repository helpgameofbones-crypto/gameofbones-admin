import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { decryptPii, revealLegacyPii } from '@/app/lib/pii-crypto';

const supabase = createClient(
  'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function readable(ciphertext: unknown, legacyValue: unknown) {
  if (typeof ciphertext === 'string' && ciphertext) {
    try { return decryptPii(ciphertext); } catch { /* fall back to the legacy field */ }
  }
  return revealLegacyPii(legacyValue);
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const { data, error } = await supabase
      .from('email_captures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      // New captures are encrypted as well as stored in their existing
      // dashboard fields. Reading the encrypted value here makes the list
      // resilient during the privacy migration and keeps all current leads
      // complete in the admin UI.
      emails: (data || []).map((capture: Record<string, unknown>) => ({
        ...capture,
        name: readable(capture.pii_name_ciphertext, capture.name) || null,
        phone: readable(capture.pii_phone_ciphertext, capture.phone) || null,
        email: readable(capture.pii_email_ciphertext, capture.email) || null,
        pii_name_ciphertext: undefined,
        pii_phone_ciphertext: undefined,
        pii_email_ciphertext: undefined,
        pii_name_hash: undefined,
        pii_phone_hash: undefined,
        pii_email_hash: undefined,
      }))
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('email_captures')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Email deleted' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
