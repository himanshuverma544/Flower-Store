import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { CartItem } from '@/types';
import {
  calculateCartPricing,
  reserveCouponAtomically,
  releaseCouponAtomically,
  commitCouponAtomically,
} from '@/lib/pricing';
import { getPayloadClient } from '@/lib/payload';

// Always run on request — never pre-render at build time (needs the database).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---- Helpers ----------------------------------------------------------------

/**
 * Full order deserializer for authorized staff and administrative tools.
 */
function deserializeFullOrder(order: {
  id: string;
  date: string;
  total: number;
  status: string;
  currentStep: number;
  estimatedDelivery: string;
  slot: string;
  recipientName: string;
  recipientAddress: string;
  recipientPhone: string;
  recipientApt: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  recipientNotes: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  keepSecret: boolean;
  cardMessage: string;
  deliveryDate: string;
  deliverySlot: string;
  itemsJson: string;
  createdAt: Date;
}) {
  return {
    id: order.id,
    date: order.date,
    total: order.total,
    status: order.status,
    currentStep: order.currentStep,
    estimatedDelivery: order.estimatedDelivery,
    slot: order.slot,
    cardMessage: order.cardMessage || undefined,
    recipient: {
      fullName: order.recipientName,
      address: order.recipientAddress,
      phone: order.recipientPhone,
      apt: order.recipientApt,
      city: order.recipientCity,
      state: order.recipientState,
      zip: order.recipientZip,
      notes: order.recipientNotes,
    },
    sender: {
      senderName: order.senderName,
      senderEmail: order.senderEmail,
      senderPhone: order.senderPhone,
      keepSecret: order.keepSecret,
    },
    items: JSON.parse(order.itemsJson || '[]') as CartItem[],
  };
}

/**
 * Privacy-safe order deserializer for customer order tracking.
 * Strictly minimizes fields: redacts recipient phone, recipient gate notes, sender email,
 * sender phone, and preserves sender anonymity when keepSecret is true.
 * If the tracking token is unverified (order ID guessed without token), address details are masked.
 */
function deserializeTrackingOrder(
  order: any,
  options: { isVerified: boolean }
) {
  let items: any[] = [];
  try {
    items = JSON.parse(order.itemsJson || '[]');
  } catch {
    items = [];
  }

  const publicItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    quantity: item.quantity || 1,
    selectedSize: item.selectedSize ? { name: item.selectedSize.name, price: item.selectedSize.price } : undefined,
    selectedVase: item.selectedVase ? { name: item.selectedVase.name, price: item.selectedVase.price } : undefined,
  }));

  // Destination address: masked unless customer has the verified tracking token
  const addressDisplay = options.isVerified
    ? (order.recipientAddress || `${order.recipientCity}, ${order.recipientState}`)
    : (order.recipientCity ? `${order.recipientCity}, ${order.recipientState}` : 'Protected Delivery Destination');

  const recipient = {
    fullName: order.recipientName,
    address: addressDisplay,
    city: order.recipientCity || '',
    state: order.recipientState || '',
    // recipientPhone, recipientNotes, recipientApt, recipientZip are DELIBERATELY EXCLUDED
  };

  // Sender info: respect keepSecret and strip contact info
  const sender: Record<string, any> = {
    keepSecret: Boolean(order.keepSecret),
  };
  if (!order.keepSecret && options.isVerified) {
    sender.senderName = order.senderName;
  }
  // senderEmail and senderPhone are DELIBERATELY EXCLUDED

  return {
    id: order.id,
    date: order.date,
    total: order.total,
    status: order.status,
    currentStep: order.currentStep,
    estimatedDelivery: order.estimatedDelivery,
    slot: order.slot,
    cardMessage: order.cardMessage || undefined,
    recipient,
    sender,
    items: publicItems,
    isRestrictedView: !options.isVerified,
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- GET --------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const token = searchParams.get('token');

    // 1. Single order tracking lookup
    if (id) {
      const order = await prisma.order.findFirst({
        where: { id: { equals: id, mode: 'insensitive' } },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, message: 'Order not found' },
          { status: 404 }
        );
      }

      // Check if requester is authenticated staff (admin or shop-manager)
      let isStaff = false;
      try {
        const payload = await getPayloadClient();
        const { user } = await payload.auth({ headers: request.headers });
        if (user && (user.role === 'admin' || user.role === 'shop-manager')) {
          isStaff = true;
        }
      } catch {
        isStaff = false;
      }

      // Authorized staff gets full order data
      if (isStaff) {
        return NextResponse.json({ success: true, order: deserializeFullOrder(order) });
      }

      // Public tracking: Check if caller has the unguessable tracking token
      let isTokenVerified = false;
      if (token && token.trim()) {
        const cleanToken = token.trim();

        // Check token securely in payload_kv
        const tokenRow: Array<{ data: any }> = await prisma.$queryRawUnsafe(
          `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
          `order_token:${order.id}`
        );

        if (tokenRow && tokenRow.length > 0 && typeof tokenRow[0].data?.trackingToken === 'string') {
          isTokenVerified = constantTimeEquals(tokenRow[0].data.trackingToken, cleanToken);
        }
      }

      // Return sanitized, privacy-safe tracking order with only necessary fields
      const trackingOrder = deserializeTrackingOrder(order, { isVerified: isTokenVerified });
      return NextResponse.json({
        success: true,
        order: trackingOrder,
        isVerified: isTokenVerified,
      });
    }

    // 2. Listing orders without an ID: protected staff-only access.
    // Unauthenticated public requests are rejected with 400 Bad Request to prevent PII harvesting.
    try {
      const payload = await getPayloadClient();
      const { user } = await payload.auth({ headers: request.headers });

      if (!user || (user.role !== 'admin' && user.role !== 'shop-manager')) {
        return NextResponse.json(
          {
            success: false,
            message: "Order ID ('id' query parameter) is required to track an order.",
          },
          { status: 400 }
        );
      }

      const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return NextResponse.json({
        success: true,
        orders: orders.map(deserializeFullOrder),
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Order ID ('id' query parameter) is required to track an order.",
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ---- POST -------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Pre-generate order identifier and cryptographically secure unguessable tracking token
  const orderId = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
  const trackingToken = crypto.randomBytes(16).toString('hex');
  let reservedCouponCode: string | null = null;

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
      estimatedDelivery,
      slot,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cart items required' },
        { status: 400 }
      );
    }

    // 1. Recalculate ALL prices, variant add-ons, shipping, and discounts server-side.
    // Never trust client-submitted subtotals, prices, or discounts.
    const pricing = await calculateCartPricing(
      items,
      couponCode,
      sender?.senderEmail
    );

    if (!pricing.valid) {
      return NextResponse.json(
        { success: false, message: pricing.error || 'Pricing validation failed.' },
        { status: 400 }
      );
    }

    // Format date string
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Tag the first item with coupon metadata in itemsJson (trackingToken is NOT included here)
    const itemsToSave = pricing.validatedItems.map((item, index) => {
      if (index === 0 && pricing.coupon) {
        return {
          ...item,
          appliedCoupon: pricing.coupon.code,
          discountAmount: pricing.discountAmount,
        };
      }
      return item;
    });

    // 2. Cross-Schema ACID Transaction: Execute coupon reservation, order creation,
    // tracking token persistence, and reservation commitment in a single transaction
    // across both 'payload' and 'public' schemas
    await prisma.$transaction(async (tx) => {
      // Step A: Reserve coupon atomically within this transaction
      if (pricing.coupon) {
        const reservation = await reserveCouponAtomically(
          {
            code: pricing.coupon.code,
            orderId,
            customerEmail: sender?.senderEmail,
          },
          tx
        );

        if (!reservation.success) {
          const err: any = new Error(reservation.error || 'Coupon reservation limit reached or coupon expired.');
          err.statusCode = 409;
          throw err;
        }
        reservedCouponCode = pricing.coupon.code;
      }

      // Step B: Persist order in public.orders
      await tx.order.create({
        data: {
          id: orderId,
          date: dateStr,
          total: pricing.total,
          status: 'Order Received & Verified',
          currentStep: 1,
          estimatedDelivery: estimatedDelivery ?? deliveryDate ?? 'Tomorrow',
          slot: slot ?? deliverySlot ?? 'Morning (9 AM - 1 PM)',

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
        JSON.stringify({ orderId, trackingToken, createdAt: new Date().toISOString() })
      );

      // Step D: Commit coupon reservation within the same transaction
      if (reservedCouponCode) {
        await commitCouponAtomically({ code: reservedCouponCode, orderId }, tx);
      }
    });

    return NextResponse.json({
      success: true,
      orderId,
      trackingToken,
      trackingUrl: `/track-order?id=${orderId}&token=${trackingToken}`,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      shippingFee: pricing.shippingFee,
      total: pricing.total,
      message: 'Flower order placed and reserved successfully',
    });
  } catch (error: any) {
    if (error.statusCode === 409) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }
    console.error('Error placing order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error placing order.' },
      { status: 500 }
    );
  }
}
