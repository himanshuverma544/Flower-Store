import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { CartItem } from '@/types';
import {
  calculateCartPricing,
  reserveCouponAtomically,
  releaseCouponAtomically,
} from '@/lib/pricing';
import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
} from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let reservedCouponCode: string | null = null;
  let orderId: string | null = null;

  try {
    const body = await request.json();
    const {
      items,
      couponCode,
      recipient,
      sender,
      cardMessage,
      deliveryDate,
      deliverySlot,
      idempotencyKey,
      _testOptions,
    } = body;

    // 1. Basic validation of items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cart items are required to create a payment order.' },
        { status: 400 }
      );
    }

    // 2. Check Idempotency: if request was already processed for this idempotency key, return existing order
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const cleanIdemKey = idempotencyKey.trim();
      const existingIdem: Array<{ data: any }> = await prisma.$queryRawUnsafe(
        `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
        `idempotency:${cleanIdemKey}`
      );

      if (existingIdem && existingIdem.length > 0 && existingIdem[0].data?.orderId) {
        const existingOrderId = existingIdem[0].data.orderId;
        const existingOrder = await prisma.order.findUnique({
          where: { id: existingOrderId },
        });

        if (existingOrder && existingOrder.status === 'Payment Pending') {
          // Retrieve Razorpay order details from payload_kv
          const rzpData: Array<{ data: any }> = await prisma.$queryRawUnsafe(
            `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
            `razorpay_order:${existingOrderId}`
          );
          const tokenData: Array<{ data: any }> = await prisma.$queryRawUnsafe(
            `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
            `order_token:${existingOrderId}`
          );

          if (rzpData && rzpData.length > 0) {
            return NextResponse.json({
              success: true,
              isExisting: true,
              orderId: existingOrderId,
              razorpayOrderId: rzpData[0].data.razorpayOrderId,
              amount: rzpData[0].data.amount,
              currency: rzpData[0].data.currency,
              keyId: getRazorpayPublicConfig().keyId!,
              trackingToken: tokenData?.[0]?.data?.trackingToken,
              total: existingOrder.total,
              status: existingOrder.status,
            });
          }
        }
      }
    }

    // 3. Authoritative Server-Side Pricing Recalculation
    // Strictly rejects client-submitted prices and recalculates against Payload CMS database
    const pricing = await calculateCartPricing(items, couponCode);
    if (!pricing.valid) {
      return NextResponse.json(
        { success: false, message: pricing.error || 'Cart validation failed' },
        { status: 400 }
      );
    }

    // Calculate integer amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(pricing.total * 100);
    if (amountInPaise <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid order total.' },
        { status: 400 }
      );
    }

    // Generate local Order ID and unguessable tracking token
    orderId = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    const trackingToken = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const itemsToSave = pricing.validatedItems.map((item) => {
      if (pricing.coupon && pricing.discountAmount > 0) {
        return {
          ...item,
          appliedCoupon: pricing.coupon.code,
          discountAmount: pricing.discountAmount,
        };
      }
      return item;
    });

    // 4. Local Persistence & Coupon Reservation (Cross-Schema ACID Transaction)
    // Inserts order with status 'Payment Pending' and reserves coupon atomically
    await prisma.$transaction(
      async (tx) => {
        // Step A: Reserve coupon atomically
        if (pricing.coupon) {
          const reservation = await reserveCouponAtomically(
            {
              code: pricing.coupon.code,
              orderId: orderId!,
              customerEmail: sender?.senderEmail,
            },
            tx
          );

          if (!reservation.success) {
            const err: any = new Error(
              reservation.error || 'Coupon reservation limit reached or coupon inactive.'
            );
            err.statusCode = 409;
            throw err;
          }
          reservedCouponCode = pricing.coupon.code;
        }

        // Step B: Persist order with status 'Payment Pending'
        await tx.order.create({
          data: {
            id: orderId!,
            date: dateStr,
            total: pricing.total,
            status: 'Payment Pending',
            currentStep: 1,
            estimatedDelivery: deliveryDate ?? 'Tomorrow',
            slot: deliverySlot ?? 'Morning (9 AM - 1 PM)',

            recipientName: recipient?.fullName ?? 'Valued Recipient',
            recipientAddress: recipient?.address ?? '',
            recipientPhone: recipient?.phone ?? '',
            recipientApt: recipient?.apt ?? '',
            recipientCity: recipient?.city ?? '',
            recipientState: recipient?.state ?? '',
            recipientZip: recipient?.zip ?? '',
            recipientNotes: recipient?.notes ?? '',

            senderName: sender?.senderName ?? 'Anonymous Gifter',
            senderEmail: sender?.senderEmail ?? '',
            senderPhone: sender?.senderPhone ?? '',
            keepSecret: sender?.keepSecret ?? false,

            cardMessage: cardMessage ?? '',
            deliveryDate: deliveryDate ?? '',
            deliverySlot: deliverySlot ?? '',

            itemsJson: JSON.stringify(itemsToSave),
          },
        });

        // Step C: Persist unguessable tracking token securely in payload_kv
        await tx.$executeRawUnsafe(
          `INSERT INTO "payload"."payload_kv" ("key", "data")
           VALUES ($1, $2::jsonb)
           ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
          `order_token:${orderId}`,
          JSON.stringify({ orderId, trackingToken, createdAt: now.toISOString() })
        );

        // Step D: Record idempotency mapping if key provided
        if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "payload"."payload_kv" ("key", "data")
             VALUES ($1, $2::jsonb)
             ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
            `idempotency:${idempotencyKey.trim()}`,
            JSON.stringify({ orderId, createdAt: now.toISOString() })
          );
        }
      },
      { timeout: 15000, maxWait: 10000 }
    );

    // 5. External Razorpay Order Creation
    // Calls Razorpay REST API on server with integer paise and INR
    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderId,
        notes: {
          orderId,
          customerEmail: sender?.senderEmail || '',
        },
        idempotencyKey: idempotencyKey ? `rzp_idem_${idempotencyKey}` : undefined,
        mockFailure: _testOptions?.mockRazorpayFailure,
      });
    } catch (rzpErr: any) {
      console.error(`Razorpay order creation failed for order ${orderId}:`, rzpErr.message);

      // Compensating Rollback:
      // Since external Razorpay call failed, mark local order as 'Payment Failed'
      // and atomically release the reserved coupon.
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'Payment Failed' },
        });

        if (reservedCouponCode) {
          await releaseCouponAtomically({
            code: reservedCouponCode,
            orderId,
          });
        }
      } catch (compensateErr) {
        console.error('Failed to run compensating rollback:', compensateErr);
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Payment gateway communication failed. Please try again.',
          error: rzpErr.message,
        },
        { status: 502 }
      );
    }

    // 6. Associate Razorpay Order ID in payload_kv (No Prisma Schema Migration Needed)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_order:${orderId}`,
      JSON.stringify({
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        status: razorpayOrder.status,
        createdAt: now.toISOString(),
      })
    );

    // Reverse lookup mapping for webhooks: razorpay_id -> orderId
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_id:${razorpayOrder.id}`,
      JSON.stringify({
        orderId,
        createdAt: now.toISOString(),
      })
    );

    // 7. Return checkout payload to client
    // Never returns RAZORPAY_KEY_SECRET!
    const { keyId } = getRazorpayPublicConfig();

    return NextResponse.json({
      success: true,
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: keyId!,
      trackingToken,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      shippingFee: pricing.shippingFee,
      total: pricing.total,
      status: 'Payment Pending',
    });
  } catch (error: any) {
    if (error.statusCode === 409) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }

    console.error('Error creating payment order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error creating payment order.' },
      { status: 500 }
    );
  }
}
