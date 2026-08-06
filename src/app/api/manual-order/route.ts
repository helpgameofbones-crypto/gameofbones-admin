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
      notes,
      address,
      city,
      state,
      pincode
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

    // The manual-order form sends flat address/city/state/pincode fields —
    // this was previously silently dropped here (never destructured above),
    // so any address someone typed into the form never actually got saved
    // and the order had no way to generate a Delhivery AWB. Store it under
    // shipping_address.street/city/state/pincode, the same shape the
    // website checkout and the Delhivery page already read. Only set the
    // column when something was actually typed in, so orders with no
    // shipping info don't get an empty-but-present shipping_address blob.
    if (address || city || state || pincode) {
      insertData.shipping_address = {
        street: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || ''
      };
    }

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
