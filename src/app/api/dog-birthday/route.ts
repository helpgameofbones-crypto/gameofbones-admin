import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { encryptPii, normalizeEmailForHash, normalizePhoneForHash, piiHash } from '@/app/lib/pii-crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;
    const { ownerName, phone, email, dogName, birthday, discountPercent } = await req.json();
    if (!phone || !dogName || !birthday) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const phoneLast10 = phone.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.from('dog_birthdays').upsert({
      phone: phoneLast10, email: email || null, owner_name: ownerName,
      pii_phone_ciphertext: encryptPii(phoneLast10), pii_email_ciphertext: encryptPii(email),
      pii_name_ciphertext: encryptPii(ownerName), pii_phone_hash: piiHash(normalizePhoneForHash(phoneLast10)),
      pii_email_hash: piiHash(normalizeEmailForHash(email)), pii_key_version: 1,
      dog_name: dogName, birthday, discount_percent: discountPercent || 15,
    }, { onConflict: 'phone,dog_name' }).select();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error registering dog birthday:', err);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;
    const phone = req.nextUrl.searchParams.get('phone');
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });
    const phoneLast10 = phone.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.from('dog_birthdays').select('*').ilike('phone', `%${phoneLast10}`);
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
