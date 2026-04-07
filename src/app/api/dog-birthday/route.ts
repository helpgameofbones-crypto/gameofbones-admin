import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerName, phone, email, dogName, birthday, discountPercent } = body;

    if (!phone || !dogName || !birthday) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneLast10 = phone.replace(/\D/g, '').slice(-10);

    const { data, error } = await supabase
      .from('dog_birthdays')
      .upsert(
        {
          phone: phoneLast10,
          email: email || null,
          owner_name: ownerName,
          dog_name: dogName,
          birthday: birthday,
          discount_percent: discountPercent || 15,
        },
        { onConflict: 'phone,dog_name' }
      )
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('Error registering dog birthday:', err);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'Phone required' }, { status: 400 });
    }

    const phoneLast10 = phone.replace(/\D/g, '').slice(-10);

    const { data, error } = await supabase
      .from('dog_birthdays')
      .select('*')
      .ilike('phone', `%${phoneLast10}`);

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}