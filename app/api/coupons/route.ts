import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Always run on request — never pre-render at build time (needs the database).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const cleanCode = (code as string || '').trim().toUpperCase();

    const coupon = await prisma.coupon.findFirst({
      where: { code: cleanCode, isActive: true },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired coupon code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      code: coupon.code,
      description: coupon.description,
      discountPercent: coupon.discountPercent ?? undefined,
      flatDiscount: coupon.flatDiscount ?? undefined,
      freeShipping: coupon.freeShipping,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
