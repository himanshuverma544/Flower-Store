import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  commitCouponAtomically,
  releaseCouponAtomically,
} from '@/lib/pricing';
import { verifyWebhookSignature } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/razorpay
 *
 * Dedicated Razorpay Webhook Endpoint.
 *
 * Requirements:
 * 1. Dedicated RAZORPAY_WEBHOOK_SECRET environment variable.
 * 2. Raw request body verification using official HMAC SHA256 algorithm.
 *    Does NOT parse or reserialize the body prior to signature verification.
 * 3. Never uses RAZORPAY_KEY_SECRET as a substitute.
 * 4. Deduplicates deliveries via payload.payload_kv (webhook_event:<eventId>).
 * 5. Handles payment.captured, order.paid, and payment.failed events.
 * 6. Validates amount, currency, and local order linkage before state changes.
 * 7. Out-of-order and concurrency safety: a delayed failure event NEVER downgrades an already-paid order.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Signature Header Check
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing x-razorpay-signature header' },
        { status: 400 }
      );
    }

    // 2. Read EXACT raw request body as string (unmodified raw bytes)
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json(
        { error: 'Empty webhook request body' },
        { status: 400 }
      );
    }

    // 3. Cryptographic Signature Verification using RAZORPAY_WEBHOOK_SECRET
    let isValidSignature = false;
    try {
      isValidSignature = verifyWebhookSignature({ rawBody, signature });
    } catch (sigErr: any) {
      console.error('Webhook signature verification error:', sigErr.message);
      return NextResponse.json(
        { error: sigErr.message || 'Webhook secret configuration error' },
        { status: 500 }
      );
    }

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // 4. Parse verified JSON payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    const eventId = payload.id;
    const eventType = payload.event;

    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: 'Missing event ID or event type' },
        { status: 400 }
      );
    }

    // 5. Event Deduplication: Atomic check-and-set in payload_kv
    const now = new Date();
    const dedupeKey = `webhook_event:${eventId}`;
    try {
      await prisma.payload_kv.create({
        data: {
          key: dedupeKey,
          data: {
            eventId,
            event: eventType,
            receivedAt: now.toISOString(),
          },
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Event already processed or in-flight (Idempotent delivery)
        return NextResponse.json({
          received: true,
          deduplicated: true,
          eventId,
        });
      }
      throw err;
    }

    // 6. Handle Supported Events
    // Event A: payment.captured or order.paid
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json({ received: true, ignored: 'Missing payment entity' });
      }

      const rzpPaymentId = payment.id;
      const rzpOrderId = payment.order_id;
      const paymentAmount = Number(payment.amount);
      const paymentCurrency = payment.currency;
      const paymentStatus = payment.status;

      // Locate local order ID via reverse mapping or notes
      let localOrderId: string | null = null;
      if (rzpOrderId) {
        const mappingRow = await prisma.payload_kv.findUnique({
          where: { key: `razorpay_id:${rzpOrderId}` },
        });
        if (mappingRow?.data && (mappingRow.data as any).orderId) {
          localOrderId = (mappingRow.data as any).orderId;
        }
      }

      if (!localOrderId && payment.notes?.orderId) {
        localOrderId = payment.notes.orderId;
      }

      if (!localOrderId) {
        console.warn(`Webhook: No local order found for Razorpay order ID ${rzpOrderId}`);
        return NextResponse.json({
          received: true,
          warning: 'No local order matched for Razorpay order ID',
        });
      }

      const order = await prisma.cms_orders.findUnique({
        where: { order_id: localOrderId },
      });

      if (!order) {
        console.warn(`Webhook: Local order ${localOrderId} not found in database`);
        return NextResponse.json({
          received: true,
          warning: `Local order ${localOrderId} not found`,
        });
      }

      // Validate currency and amount
      if (paymentCurrency !== 'INR') {
        console.error(`Webhook: Payment currency mismatch (${paymentCurrency}) for order ${localOrderId}`);
        return NextResponse.json(
          { error: 'Payment currency mismatch' },
          { status: 400 }
        );
      }

      const expectedPaise = Math.round(Number(order.total) * 100);
      if (paymentAmount !== expectedPaise) {
        console.error(
          `Webhook: Payment amount mismatch for order ${localOrderId}: expected ${expectedPaise} paise, received ${paymentAmount} paise`
        );
        return NextResponse.json(
          { error: 'Payment amount mismatch' },
          { status: 400 }
        );
      }

      // Validate payment status
      if (paymentStatus !== 'captured') {
        console.warn(
          `Webhook: Payment ${rzpPaymentId} for order ${localOrderId} is not captured (status: ${paymentStatus})`
        );
        return NextResponse.json({
          received: true,
          status: paymentStatus,
          message: 'Payment not captured yet',
        });
      }

      // Atomic state transition
      await prisma.$transaction(
        async (tx) => {
          const freshOrder = await tx.cms_orders.findUnique({
            where: { order_id: localOrderId! },
            select: { status: true, items_json: true },
          });

          if (freshOrder?.status === 'Order_Received___Verified') {
            // Already verified (e.g. by client verification endpoint) - idempotent
            return;
          }

          // Mark order paid in payload.cms_orders
          await tx.cms_orders.update({
            where: { order_id: localOrderId! },
            data: {
              status: 'Order_Received___Verified',
              payment_status: 'paid',
              razorpay_order_id: rzpOrderId || undefined,
              razorpay_payment_id: rzpPaymentId,
              current_step: 1,
            },
          });

          // Commit coupon reservation
          let couponCode: string | null = null;
          try {
            const items = JSON.parse(freshOrder?.items_json || '[]');
            couponCode = items?.[0]?.appliedCoupon || null;
          } catch {
            // ignore
          }

          await commitCouponAtomically({ code: couponCode || '', orderId: localOrderId! }, tx);

          // Persist payment record in payload_kv
          await tx.payload_kv.upsert({
            where: { key: `razorpay_payment:${localOrderId}` },
            create: {
              key: `razorpay_payment:${localOrderId}`,
              data: {
                orderId: localOrderId,
                razorpayOrderId: rzpOrderId,
                razorpayPaymentId: rzpPaymentId,
                amount: paymentAmount,
                currency: paymentCurrency,
                status: paymentStatus,
                method: payment.method || 'webhook',
                verifiedAt: now.toISOString(),
              },
            },
            update: {
              data: {
                orderId: localOrderId,
                razorpayOrderId: rzpOrderId,
                razorpayPaymentId: rzpPaymentId,
                amount: paymentAmount,
                currency: paymentCurrency,
                status: paymentStatus,
                method: payment.method || 'webhook',
                verifiedAt: now.toISOString(),
              },
            },
          });

          // Reverse lookup mapping for payment ID -> orderId
          await tx.payload_kv.upsert({
            where: { key: `razorpay_payment_id:${rzpPaymentId}` },
            create: {
              key: `razorpay_payment_id:${rzpPaymentId}`,
              data: {
                orderId: localOrderId,
                razorpayOrderId: rzpOrderId,
                verifiedAt: now.toISOString(),
              },
            },
            update: {
              data: {
                orderId: localOrderId,
                razorpayOrderId: rzpOrderId,
                verifiedAt: now.toISOString(),
              },
            },
          });
        },
        { timeout: 15000, maxWait: 10000 }
      );

      return NextResponse.json({
        received: true,
        orderId: localOrderId,
        status: 'Order Received & Verified',
      });
    }

    // Event B: payment.failed
    if (eventType === 'payment.failed') {
      const payment = payload.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json({ received: true, ignored: 'Missing payment entity' });
      }

      const rzpOrderId = payment.order_id;
      let localOrderId: string | null = null;

      if (rzpOrderId) {
        const mappingRow = await prisma.payload_kv.findUnique({
          where: { key: `razorpay_id:${rzpOrderId}` },
        });
        if (mappingRow?.data && (mappingRow.data as any).orderId) {
          localOrderId = (mappingRow.data as any).orderId;
        }
      }

      if (!localOrderId && payment.notes?.orderId) {
        localOrderId = payment.notes.orderId;
      }

      if (!localOrderId) {
        return NextResponse.json({ received: true, warning: 'No local order matched' });
      }

      const order = await prisma.cms_orders.findUnique({
        where: { order_id: localOrderId },
        select: { order_id: true, status: true, items_json: true },
      });

      if (!order) {
        return NextResponse.json({ received: true, warning: 'Order not found' });
      }

      // CRITICAL: A delayed or out-of-order failure event MUST NOT downgrade a confirmed paid order!
      if ((order.status as string) === 'Order_Received___Verified') {
        console.warn(
          `Webhook: Ignoring payment.failed for already-verified order ${localOrderId}`
        );
        return NextResponse.json({
          received: true,
          ignored: 'Order already confirmed as paid. Failure event ignored.',
        });
      }

      // Only transition if order is still 'Payment Pending'
      if ((order.status as string) === 'Payment_Pending') {
        await prisma.$transaction(
          async (tx) => {
            await tx.cms_orders.update({
              where: { order_id: localOrderId! },
              data: {
                status: 'Payment_Failed',
                payment_status: 'failed',
              },
            });

            // Extract coupon code if any to release reservation
            let couponCode: string | null = null;
            try {
              const items = JSON.parse(order.items_json || '[]');
              couponCode = items?.[0]?.appliedCoupon || null;
            } catch {
              // ignore
            }

            if (couponCode) {
              await releaseCouponAtomically({ code: couponCode, orderId: localOrderId! }, tx);
            }

            // Persist failure record
            await tx.payload_kv.upsert({
              where: { key: `razorpay_failed:${localOrderId}` },
              create: {
                key: `razorpay_failed:${localOrderId}`,
                data: {
                  orderId: localOrderId,
                  paymentId: payment.id,
                  errorDescription: payment.error_description || 'Payment failed',
                  failedAt: now.toISOString(),
                },
              },
              update: {
                data: {
                  orderId: localOrderId,
                  paymentId: payment.id,
                  errorDescription: payment.error_description || 'Payment failed',
                  failedAt: now.toISOString(),
                },
              },
            });
          },
          { timeout: 15000, maxWait: 10000 }
        );

        return NextResponse.json({
          received: true,
          orderId: localOrderId,
          status: 'Payment Failed',
        });
      }

      return NextResponse.json({
        received: true,
        orderId: localOrderId,
        status: order.status,
        message: 'No status change needed',
      });
    }

    // Default: Other events are acknowledged
    return NextResponse.json({
      received: true,
      unhandled: eventType,
    });
  } catch (error: any) {
    console.error('Error processing Razorpay webhook:', error);
    // Return 500 so Razorpay can retry transient server failures
    return NextResponse.json(
      { error: error.message || 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}
