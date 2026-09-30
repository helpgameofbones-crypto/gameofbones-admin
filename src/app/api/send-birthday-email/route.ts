import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { corsHeaders } from '@/app/lib/cors';
import { resend } from '@/app/lib/emailClient';
import { birthdayOfferEmail, ensureBirthdayOffer } from '@/app/lib/birthday-offer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const { dogId } = await req.json();

    if (!dogId) {
      return NextResponse.json(
        { error: 'Missing dogId' },
        { status: 400, headers }
      );
    }

    // Fetch the dog birthday entry
    const { data: birthday, error: fetchError } = await supabase
      .from('dog_birthdays')
      .select('*')
      .eq('id', dogId)
      .single();

    if (fetchError || !birthday) {
      return NextResponse.json(
        { error: 'Dog not found' },
        { status: 404, headers }
      );
    }

    if (!birthday.customer_email) {
      return NextResponse.json(
        { error: 'No email on file' },
        { status: 400, headers }
      );
    }

    const offer = await ensureBirthdayOffer(supabase, birthday);
    const email = birthdayOfferEmail(birthday, offer.code);
    await resend.emails.send({
      to: birthday.customer_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await supabase.from('dog_birthdays').update({ last_email_sent: new Date().toISOString() }).eq('id', birthday.id);

    // Log the email send in audit trail if you have one
    console.log(`Birthday email sent to ${birthday.customer_email} for ${birthday.dog_name}`);

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { headers }
    );
  } catch (error: any) {
    console.error('Birthday email error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500, headers: corsHeaders(req) }
    );
  }
}
