import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { corsHeaders } from '@/app/lib/cors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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

    // Generate unique discount code
    const uniqueCode = `BDAY${birthday.id.slice(0, 12).toUpperCase()}`;
    const today = new Date().toISOString().split('T')[0];

    // Send email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: birthday.customer_email,
      subject: `🎂 ${birthday.dog_name}'s Special Birthday Treat from Game of Bones!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1008;">Happy Birthday to ${birthday.dog_name}! 🎂🐾</h2>
          <p style="font-size: 16px; color: #7a6a5a;">Hi ${birthday.customer_name},</p>

          <p style="font-size: 16px; color: #7a6a5a;">
            We'd like to celebrate <strong>${birthday.dog_name}'s special day</strong> with a birthday surprise!
          </p>

          <div style="background: #faf6f0; border: 2px solid #c8973a; padding: 24px; text-align: center; margin: 24px 0; border-radius: 4px;">
            <p style="font-size: 14px; color: #7a6a5a; margin: 0 0 12px 0;">Your Exclusive Birthday Discount</p>
            <p style="font-size: 32px; font-weight: bold; color: #c8973a; margin: 0; letter-spacing: 2px;">20% OFF</p>
            <p style="font-size: 12px; color: #7a6a5a; margin: 12px 0 0 0;">Use code at checkout</p>
          </div>

          <div style="background: #fff; border: 1px solid #ede5d8; padding: 16px; text-align: center; margin: 20px 0; border-radius: 4px;">
            <p style="font-size: 12px; color: #7a6a5a; margin: 0 0 8px 0;">Your Unique Discount Code:</p>
            <p style="font-size: 18px; font-weight: bold; color: #1a1008; letter-spacing: 1px; margin: 0; font-family: monospace;">${uniqueCode}</p>
            <p style="font-size: 11px; color: #7a6a5a; margin: 8px 0 0 0;">This code is unique to ${birthday.dog_name} and can only be used once</p>
          </div>

          <p style="font-size: 14px; color: #7a6a5a;">
            <a href="https://gameofbones.in/shop" style="color: #c8973a; text-decoration: none; font-weight: bold;">Shop Now & Treat Your Pup →</a>
          </p>

          <p style="font-size: 12px; color: #7a6a5a; margin-top: 32px;">
            Cheers to ${birthday.dog_name}!<br>
            <strong>Game of Bones Team 🐾</strong>
          </p>
        </div>
      `
    });

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
