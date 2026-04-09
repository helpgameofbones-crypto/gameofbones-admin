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
      customerPhone,
      customerEmail,
      items, 
      total, 
      paymentMethod, 
      transactionId,
      notes 
    } = body;

    const insertData: any = {
      customer_phone: customerPhone,
      customer_name: customerName,
    };

    if (customerEmail) insertData.customer_email = customerEmail;
    if (total) insertData.total_amount = total;
    if (paymentMethod) insertData.payment_method = paymentMethod;
    if (transactionId) insertData.transaction_id = transactionId;
    if (notes) insertData.notes = notes;
    if (items) insertData.items = items;
    
    insertData.status = 'confirmed';

    const { data, error } = await supabase
      .from('orders')
      .insert([insertData])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order created',
      data
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}