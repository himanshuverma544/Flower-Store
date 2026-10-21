import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { commitCouponAtomically } from '@/lib/pricing';
import {
  verifyPaymentSignature,
  fetchRazorpayPayment,
  RazorpayPaymentDetails,
} from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/payments/verify
 *
 * Dedicated server-side payment verification endpoint.
 *
 * Verifies:
 * 1. Required parameters (orderId, razorpayPaymentId, razorpaySignature)
 * 2. Order existence and customer authorization (tracking token)
 * 3. Server-authoritative Razorpay Order ID match (never trusts arbitrary client order ID)
 * 4. Constant-time HMAC SHA256 payment signature verification
 * 5. Authoritative payment details from Razorpay (amount, currency, captured status)
 * 6. Atomic state transition: 'Payment Pending' -> 'Order Received & Verified'
 * 7. Atomic coupon reservation commitment ('reserved' -> 'committed')
 * 8. Concurrency & Idempotency guards (duplicate verification returns idempotent success,
 *    conflicting payment IDs rejected with 409 Conflict)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      trackingToken,
      _mockPayment,
    } = body;

    // 1. Missing or malformed fields validation
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json(
        { success: false, message: 'Missing required field: orderId.' },
        { status: 400 }
      );
    }

    if (!razorpayPaymentId || typeof razorpayPaymentId !== 'string' || !razorpayPaymentId.trim()) {
      return NextResponse.json(
        { success: false, message: 'Missing required field: razorpayPaymentId.' },
        { status: 400 }
      );
    }

    if (!razorpaySignature || typeof razorpaySignature !== 'string' || !razorpaySignature.trim()) {
      return NextResponse.json(
        { success: false, message: 'Missing required field: razorpaySignature.' },
        { status: 400 }
      );
    }

    const cleanOrderId = orderId.trim();
    const cleanPaymentId = razorpayPaymentId.trim();
    const cleanSignature = razorpaySignature.trim();

    // 2. Locate local order from Payload CMS Orders collection
    const order = await prisma.cms_orders.findUnique({
      where: { order_id: cleanOrderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: `Order "${cleanOrderId}" not found.` },
        { status: 404 }
      );
    }

    // 3. Authorization check via tracking token if provided
    if (trackingToken && typeof trackingToken === 'string') {
      const tokenRow = await prisma.payload_kv.findUnique({
        where: { key: `order_token:${cleanOrderId}` },
      });

      if (tokenRow?.data && (tokenRow.data as any).trackingToken) {
        if ((tokenRow.data as any).trackingToken !== trackingToken.trim()) {
          return NextResponse.json(
            { success: false, message: 'Unauthorized: Invalid tracking token for this order.' },
            { status: 403 }
          );
        }
      }
    }

    // 4. Locate authoritative expected Razorpay order ID from payload_kv
    const rzpRow = await prisma.payload_kv.findUnique({
      where: { key: `razorpay_order:${cleanOrderId}` },
    });

    if (!rzpRow?.data || !(rzpRow.data as any).razorpayOrderId) {
      return NextResponse.json(
        { success: false, message: `No payment session found for order "${cleanOrderId}".` },
        { status: 400 }
      );
    }

    const storedRzpData = rzpRow.data as any;
    const expectedRazorpayOrderId = storedRzpData.razorpayOrderId;

    // Validate client-supplied Razorpay order ID if provided
    if (razorpayOrderId && typeof razorpayOrderId === 'string') {
      if (razorpayOrderId.trim() !== expectedRazorpayOrderId) {
        return NextResponse.json(
          { success: false, message: 'Mismatched Razorpay order ID.' },
          { status: 400 }
        );
      }
    }

    // 5. Idempotency & Conflict Check
    if ((order.status as string) === 'Order_Received___Verified') {
      const existingPaymentRow = await prisma.payload_kv.findUnique({
        where: { key: `razorpay_payment:${cleanOrderId}` },
      });

      const recordedPaymentId = (existingPaymentRow?.data as any)?.razorpayPaymentId;
      if (recordedPaymentId && recordedPaymentId !== cleanPaymentId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Order has already been verified and paid with a different payment ID.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        isExisting: true,
        orderId: cleanOrderId,
        razorpayOrderId: expectedRazorpayOrderId,
        razorpayPaymentId: cleanPaymentId,
        status: 'Order Received & Verified',
        message: 'Payment has already been verified for this order.',
      });
    }

    if (order.status !== 'Payment_Pending') {
      return NextResponse.json(
        {
          success: false,
          message: `Order cannot be verified because it is currently in "${order.status}" status.`,
        },
        { status: 400 }
      );
    }

    // 6. Server-Side Cryptographic Signature Verification
    // STRICT: Must use the server-stored Razorpay order ID, never an arbitrary client input!
    const isSignatureValid = verifyPaymentSignature({
      razorpayOrderId: expectedRazorpayOrderId,
      razorpayPaymentId: cleanPaymentId,
      razorpaySignature: cleanSignature,
    });

    if (!isSignatureValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment signature.' },
        { status: 400 }
      );
    }

    // 7. Authoritative Payment Status & Details Check
    // A valid signature alone is not sufficient; capture status must be verified!
    let payment: RazorpayPaymentDetails;
    try {
      payment = await fetchRazorpayPayment(cleanPaymentId, {
        mockPayment: _mockPayment,
      });
    } catch (fetchErr: any) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to verify payment status with gateway.',
          error: fetchErr.message,
        },
        { status: 502 }
      );
    }

    // Verify payment belongs to expected Razorpay order ID
    if (payment.order_id !== expectedRazorpayOrderId) {
      return NextResponse.json(
        { success: false, message: 'Payment does not belong to the expected order.' },
        { status: 400 }
      );
    }

    // Verify payment currency
    if (payment.currency !== 'INR') {
      return NextResponse.json(
        { success: false, message: 'Invalid payment currency.' },
        { status: 400 }
      );
    }

    // Verify authoritative amount (paise)
    const expectedPaise = storedRzpData.amount || Math.round(Number(order.total) * 100);
    if (payment.amount !== expectedPaise) {
      return NextResponse.json(
        {
          success: false,
          message: `Payment amount mismatch: expected ${expectedPaise} paise but received ${payment.amount} paise.`,
        },
        { status: 400 }
      );
    }

    // Verify capture status
    if (payment.status !== 'captured') {
      return NextResponse.json(
        {
          success: false,
          message: `Payment is not in captured status (current status: ${payment.status}).`,
        },
        { status: 400 }
      );
    }

    // 8. Atomic State Transition & Coupon Commitment
    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        // Re-read inside transaction for strict concurrency isolation
        const currentOrder = await tx.cms_orders.findUnique({
          where: { order_id: cleanOrderId },
          select: { status: true, items_json: true },
        });

        if (currentOrder?.status === 'Order_Received___Verified') {
          return; // Concurrently updated by webhook
        }

        // Step A: Mark order paid in payload.cms_orders
        await tx.cms_orders.update({
          where: { order_id: cleanOrderId },
          data: {
            status: 'Order_Received___Verified',
            payment_status: 'paid',
            razorpay_payment_id: cleanPaymentId,
            razorpay_signature: cleanSignature,
            current_step: 1,
          },
        });

        // Step B: Commit coupon reservation atomically
        let couponCode: string | null = null;
        try {
          const items = JSON.parse(currentOrder?.items_json || '[]');
          couponCode = items?.[0]?.appliedCoupon || null;
        } catch {
          // ignore
        }

        if (couponCode) {
          await commitCouponAtomically({ code: couponCode, orderId: cleanOrderId }, tx);
        } else {
          await commitCouponAtomically({ code: '', orderId: cleanOrderId }, tx);
        }

        // Step C: Persist payment record in payload_kv
        await tx.payload_kv.upsert({
          where: { key: `razorpay_payment:${cleanOrderId}` },
          create: {
            key: `razorpay_payment:${cleanOrderId}`,
            data: {
              orderId: cleanOrderId,
              razorpayOrderId: expectedRazorpayOrderId,
              razorpayPaymentId: cleanPaymentId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              method: payment.method || 'unknown',
              verifiedAt: now.toISOString(),
            },
          },
          update: {
            data: {
              orderId: cleanOrderId,
              razorpayOrderId: expectedRazorpayOrderId,
              razorpayPaymentId: cleanPaymentId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              method: payment.method || 'unknown',
              verifiedAt: now.toISOString(),
            },
          },
        });

        // Step D: Reverse lookup mapping for payment ID -> orderId
        await tx.payload_kv.upsert({
          where: { key: `razorpay_payment_id:${cleanPaymentId}` },
          create: {
            key: `razorpay_payment_id:${cleanPaymentId}`,
            data: {
              orderId: cleanOrderId,
              razorpayOrderId: expectedRazorpayOrderId,
              verifiedAt: now.toISOString(),
            },
          },
          update: {
            data: {
              orderId: cleanOrderId,
              razorpayOrderId: expectedRazorpayOrderId,
              verifiedAt: now.toISOString(),
            },
          },
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );

    return NextResponse.json({
      success: true,
      orderId: cleanOrderId,
      razorpayOrderId: expectedRazorpayOrderId,
      razorpayPaymentId: cleanPaymentId,
      status: 'Order Received & Verified',
      message: 'Payment verified and order confirmed successfully.',
    });
  } catch (error: any) {
    console.error('Error during payment verification:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error verifying payment.',
      },
      { status: 500 }
    );
  }
}
