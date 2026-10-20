import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateCartPricing } from '@/lib/pricing';

// Always run on request — never pre-render at build time (needs the database).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Validates a coupon promo code against authoritative Payload CMS coupons (payload.cms_coupons).
 * When cart items are provided, recalculates subtotal, min spend qualification, discount caps,
 * and resulting totals server-side.
 *
 * NOTE: This endpoint is strictly a read-only preview and NEVER consumes coupon usage.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { code, items, email } = body;
    const cleanCode = (code as string || '').trim().toUpperCase();

    if (!cleanCode) {
      return NextResponse.json(
        { success: false, message: 'Promo code is required.' },
        { status: 400 }
      );
    }

    // If items are provided, perform full server-side pricing recalculation and coupon check
    if (Array.isArray(items) && items.length > 0) {
      const calculation = await calculateCartPricing(items, cleanCode, email);

      if (!calculation.valid || !calculation.coupon) {
        return NextResponse.json(
          {
            success: false,
            message: calculation.error || 'Invalid or expired coupon code.',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        code: calculation.coupon.code,
        description: calculation.coupon.description,
        discountType: calculation.coupon.discountType,
        discountValue: calculation.coupon.discountValue,
        discountAmount: calculation.discountAmount,
        freeShipping: calculation.coupon.freeShipping,
        minSpend: calculation.coupon.minSpend,
        maxDiscount: calculation.coupon.maxDiscount,
        subtotal: calculation.subtotal,
        shippingFee: calculation.shippingFee,
        total: calculation.total,
      });
    }

    // Fallback: Validate coupon existence and status if no cart items were passed
    const couponRows: Array<{
      id: number;
      code: string;
      description: string | null;
      discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
      discount_value: number;
      min_spend: number | null;
      max_discount: number | null;
      usage_limit_total: number | null;
      usage_count: number;
      is_active: boolean;
      start_date: string | null;
      end_date: string | null;
    }> = await prisma.$queryRawUnsafe(
      `SELECT id, code, description, discount_type, discount_value, min_spend, max_discount,
              usage_limit_total, usage_count, is_active, start_date, end_date
       FROM payload.cms_coupons
       WHERE code = $1;`,
      cleanCode
    );

    if (!couponRows || couponRows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Coupon "${cleanCode}" is invalid or does not exist.` },
        { status: 400 }
      );
    }

    const c = couponRows[0];
    if (!c.is_active) {
      return NextResponse.json(
        { success: false, message: `Coupon "${cleanCode}" is currently inactive.` },
        { status: 400 }
      );
    }

    const now = new Date();
    if (c.start_date && now < new Date(c.start_date)) {
      return NextResponse.json(
        { success: false, message: `Coupon "${cleanCode}" is not active yet.` },
        { status: 400 }
      );
    }

    if (c.end_date && now > new Date(c.end_date)) {
      return NextResponse.json(
        { success: false, message: `Coupon "${cleanCode}" has expired.` },
        { status: 400 }
      );
    }

    const totalLimit = c.usage_limit_total !== null ? Number(c.usage_limit_total) : 0;
    const currentUsage = Number(c.usage_count || 0);
    if (totalLimit > 0 && currentUsage >= totalLimit) {
      return NextResponse.json(
        { success: false, message: `Coupon "${cleanCode}" has reached its maximum total usage limit.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      code: c.code,
      description: c.description || '',
      discountType: c.discount_type,
      discountValue: Number(c.discount_value),
      minSpend: c.min_spend !== null ? Number(c.min_spend) : 0,
      maxDiscount: c.max_discount !== null ? Number(c.max_discount) : null,
      freeShipping: c.discount_type === 'free_shipping',
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error validating coupon.' },
      { status: 500 }
    );
  }
}
