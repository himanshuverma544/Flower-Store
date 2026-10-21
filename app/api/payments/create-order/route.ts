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
      const existingIdem = await prisma.payload_kv.findUnique({
        where: { key: `idempotency:${cleanIdemKey}` },
      });

      if (existingIdem?.data && (existingIdem.data as any).orderId) {
        const existingOrderId = (existingIdem.data as any).orderId;
        const existingOrder = await prisma.cms_orders.findUnique({
          where: { order_id: existingOrderId },
        });

        if (existingOrder && (existingOrder.status as string) === 'Payment_Pending') {
          // Retrieve Razorpay order details from payload_kv
          const rzpData = await prisma.payload_kv.findUnique({
            where: { key: `razorpay_order:${existingOrderId}` },
          });
          const tokenData = await prisma.payload_kv.findUnique({
            where: { key: `order_token:${existingOrderId}` },
          });

          if (rzpData?.data) {
            const rzpObj = rzpData.data as any;
            const tokenObj = tokenData?.data as any;
            return NextResponse.json({
              success: true,
              isExisting: true,
              orderId: existingOrderId,
              razorpayOrderId: rzpObj.razorpayOrderId,
              amount: rzpObj.amount,
              currency: rzpObj.currency,
              keyId: getRazorpayPublicConfig().keyId!,
              trackingToken: tokenObj?.trackingToken || existingOrder.tracking_token,
              total: Number(existingOrder.total),
              status: 'Payment Pending',
            });
          }
        }
      }
    }

    // 3. Authoritative Server-Side Pricing Recalculation
    // Strictly rejects client-submitted prices and recalculates against Payload CMS database
    const pricing = await calculateCartPricing(items, couponCode, sender?.senderEmail);
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

        // Step B: Persist order in Payload CMS Orders collection
        await tx.cms_orders.create({
          data: {
            order_id: orderId!,
            status: 'Payment_Pending',
            current_step: 1,
            date: dateStr,
            total: pricing.total,
            subtotal: pricing.subtotal,
            delivery_fee: pricing.shippingFee,
            discount: pricing.discountAmount,
            sender_name: sender?.senderName ?? 'Anonymous Gifter',
            sender_email: sender?.senderEmail ?? '',
            sender_phone: sender?.senderPhone ?? '',
            keep_secret: Boolean(sender?.keepSecret),
            recipient_name: recipient?.fullName ?? 'Valued Recipient',
            recipient_phone: recipient?.phone ?? '',
            recipient_address: recipient?.address ?? '',
            recipient_apt: recipient?.apt ?? '',
            recipient_city: recipient?.city ?? '',
            recipient_state: recipient?.state ?? '',
            recipient_zip: recipient?.zip ?? '',
            card_message: cardMessage ?? '',
            recipient_notes: recipient?.notes ?? '',
            delivery_date: deliveryDate ?? '',
            delivery_slot: deliverySlot ?? '',
            estimated_delivery: deliveryDate ?? 'Tomorrow',
            slot: deliverySlot ?? 'Morning (9 AM - 1 PM)',
            items: itemsToSave as any,
            items_json: JSON.stringify(itemsToSave),
            payment_method: 'razorpay',
            payment_status: 'pending',
            tracking_token: trackingToken,
            idempotency_key: idempotencyKey?.trim() || null,
          },
        });

        // Step C: Persist unguessable tracking token securely in payload_kv
        await tx.payload_kv.upsert({
          where: { key: `order_token:${orderId}` },
          create: {
            key: `order_token:${orderId}`,
            data: { orderId, trackingToken, createdAt: now.toISOString() },
          },
          update: {
            data: { orderId, trackingToken, createdAt: now.toISOString() },
          },
        });

        // Step D: Record idempotency mapping if key provided
        if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
          await tx.payload_kv.upsert({
            where: { key: `idempotency:${idempotencyKey.trim()}` },
            create: {
              key: `idempotency:${idempotencyKey.trim()}`,
              data: { orderId, createdAt: now.toISOString() },
            },
            update: {
              data: { orderId, createdAt: now.toISOString() },
            },
          });
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
        await prisma.cms_orders.update({
          where: { order_id: orderId },
          data: {
            status: 'Payment_Failed',
            payment_status: 'failed',
          },
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

    // 6. Associate Razorpay Order ID in payload_kv
    await prisma.payload_kv.upsert({
      where: { key: `razorpay_order:${orderId}` },
      create: {
        key: `razorpay_order:${orderId}`,
        data: {
          orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          status: razorpayOrder.status,
          createdAt: now.toISOString(),
        },
      },
      update: {
        data: {
          orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          status: razorpayOrder.status,
          createdAt: now.toISOString(),
        },
      },
    });

    // Reverse lookup mapping for webhooks: razorpay_id -> orderId
    await prisma.payload_kv.upsert({
      where: { key: `razorpay_id:${razorpayOrder.id}` },
      create: {
        key: `razorpay_id:${razorpayOrder.id}`,
        data: {
          orderId,
          createdAt: now.toISOString(),
        },
      },
      update: {
        data: {
          orderId,
          createdAt: now.toISOString(),
        },
      },
    });

    // Also update razorpay_order_id directly in payload.cms_orders
    await prisma.cms_orders.update({
      where: { order_id: orderId },
      data: {
        razorpay_order_id: razorpayOrder.id,
      },
    });

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
