import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { 
      customerName, 
      customerEmail, 
      customerPhone, 
      items, 
      total, 
      paymentMethod, 
      transactionId,
      notes 
    } = body;

    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          order_ref: `MAN${Date.now()}`,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          items: items,
          total_amount: total,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          status: 'confirmed',
          notes: notes,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Manual order created',
      order: data 
    });
  } catch (error) {
    console.error('Error creating manual order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}