import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get date 7 days from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const targetDate = nextWeek.toISOString().split('T')[0];
    
    const { data: birthdays, error } = await supabase
      .from('dog_birthdays')
      .select('*')
      .eq('birthday', targetDate)
      .is('last_discount_sent', null);

    if (error) throw error;

    let sent = 0;
    for (const birthday of birthdays) {
      // Generate unique discount code: BDAY + UUID first 12 chars
      const uniqueCode = `BDAY${birthday.id.slice(0, 12).toUpperCase()}`;
      
      await resend.emails.send({
        from: 'Game of Bones <hello@gameofbones.in>',
        to: birthday.email,
        subject: `🎂 ${birthday.dog_name}'s Birthday is Coming! Here's 20% Off`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1008;">Exciting News! 🎉</h2>
            <p style="font-size: 16px; color: #7a6a5a;">Hi ${birthday.owner_name},</p>
            
            <p style="font-size: 16px; color: #7a6a5a;">
              <strong>${birthday.dog_name}'s birthday is coming up in just 7 days!</strong> 🐾
            </p>
            
            <p style="font-size: 16px; color: #7a6a5a;">
              We'd like to celebrate with a special gift for your furry friend:
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
              Valid from ${targetDate} through ${new Date(nextWeek.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            </p>
            
            <p style="font-size: 14px; color: #7a6a5a;">
              <a href="https://gameofbones.in/shop" style="color: #c8973a; text-decoration: none; font-weight: bold;">Shop Now →</a>
            </p>
            
            <p style="font-size: 12px; color: #7a6a5a; margin-top: 32px;">
              Cheers to ${birthday.dog_name}!<br>
              <strong>Game of Bones Team 🐾</strong>
            </p>
          </div>
        `
      });

      // Mark as sent
      await supabase
        .from('dog_birthdays')
        .update({ last_discount_sent: targetDate })
        .eq('id', birthday.id);

      sent++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent ${sent} birthday reminder emails`,
      sentCount: sent
    });
  } catch (error) {
    console.error('Birthday notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send birthday emails' },
      { status: 500 }
    );
  }
}