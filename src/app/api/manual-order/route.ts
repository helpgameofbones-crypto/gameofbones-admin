import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Received body:', body);
    
    const { 
      customerName, 
      customerPhone,
      customerEmail,
      items, 
      total, 
      paymentMethod, 
      transactionId,
      notes 
    } = body;

    const insertData: any = {
      customer_name: customerName,
      customer_phone: customerPhone,
    };

    if (customerEmail) insertData.customer_email = customerEmail;
    if (total) insertData.total_amount = total;
    if (paymentMethod) insertData.payment_method = paymentMethod;
    if (transactionId) insertData.transaction_id = transactionId;
    if (notes) insertData.notes = notes;
    if (items) insertData.items = items;

    console.log('Insert data:', insertData);

    const { data, error } = await supabase
      .from('orders')
      .insert([insertData]);

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          details: error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order created',
      data
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: String(error)
      },
      { status: 500 }
    );
  }
}