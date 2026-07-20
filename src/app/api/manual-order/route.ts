import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const body = await req.json();

    const {
      customerName,
      customerPhone,
      customerEmail,
      items,
      total,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      paymentMethod,
      transactionId,
      notes
    } = body;

    // Ensure items have all required fields
    const formattedItems = items.map((item: any) => ({
      id: item.product_id || item.id,
      name: item.name,
      quantity: item.quantity || 1,
      price: item.price || 0,
      product_id: item.product_id || item.id
    }));

    // Discount support: `total` is already the final (post-discount) amount
    // computed client-side. `subtotal` and `discountAmount` are recorded
    // separately so the order breakdown matches the website's checkout
    // orders (total_amount = pre-discount, discount = amount off,
    // grand_total = what was actually charged).
    const computedSubtotal = typeof subtotal === 'number' ? subtotal : total;
    const computedDiscount = typeof discountAmount === 'number' ? discountAmount : 0;

    const insertData: any = {
      ref: `MAN${Date.now()}`,
      customer_phone: customerPhone,
      customer_name: customerName,
      items: formattedItems,
      total_amount: computedSubtotal,
      discount: computedDiscount,
      grand_total: total,
    };

    if (customerEmail) insertData.customer_email = customerEmail;
    if (paymentMethod) insertData.payment_method = paymentMethod;
    if (transactionId) insertData.transaction_id = transactionId;
    if (discountType && computedDiscount > 0) {
      insertData.coupon_code = discountType === 'percent' ? `MANUAL_${discountValue}PCT` : `MANUAL_${discountValue}OFF`;
    }
    if (notes) insertData.notes = notes;

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
