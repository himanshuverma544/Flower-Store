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

function normalizeDisplayStatus(status: string): string {
  const map: Record<string, string> = {
    Payment_Pending: 'Payment Pending',
    Order_Received___Verified: 'Order Received & Verified',
    Order_Received: 'Order Received',
    Crafting_Floral_Arrangement: 'Crafting Floral Arrangement',
    Out_for_Delivery: 'Out for Delivery',
    Delivered: 'Delivered',
    Payment_Failed: 'Payment Failed',
    Payment_Expired: 'Payment Expired',
    Cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function mapPayloadOrderToRow(row: any) {
  if (!row) return null;
  return {
    id: row.order_id,
    date: row.date,
    total: Number(row.total),
    status: normalizeDisplayStatus(row.status),
    currentStep: Number(row.current_step || 1),
    estimatedDelivery: row.estimated_delivery,
    slot: row.slot,
    recipientName: row.recipient_name,
    recipientAddress: row.recipient_address,
    recipientPhone: row.recipient_phone,
    recipientApt: row.recipient_apt,
    recipientCity: row.recipient_city,
    recipientState: row.recipient_state,
    recipientZip: row.recipient_zip,
    recipientNotes: row.recipient_notes,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    senderPhone: row.sender_phone,
    keepSecret: Boolean(row.keep_secret),
    cardMessage: row.card_message,
    deliveryDate: row.delivery_date,
    deliverySlot: row.delivery_slot,
    itemsJson: row.items_json || JSON.stringify(row.items || []),
    trackingToken: row.tracking_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- GET --------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const token = searchParams.get('token');

    // 1. Single order tracking lookup from Payload CMS Orders
    if (id) {
      const row = await prisma.cms_orders.findFirst({
        where: { order_id: { equals: id.trim(), mode: 'insensitive' } },
      });
      const order = mapPayloadOrderToRow(row);

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

        if (order.trackingToken && constantTimeEquals(order.trackingToken, cleanToken)) {
          isTokenVerified = true;
        } else {
          // Check token in payload_kv fallback
          const tokenRow = await prisma.payload_kv.findUnique({
            where: { key: `order_token:${order.id}` },
          });

          if (tokenRow?.data && typeof (tokenRow.data as any).trackingToken === 'string') {
            isTokenVerified = constantTimeEquals((tokenRow.data as any).trackingToken, cleanToken);
          }
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

      const rows = await prisma.cms_orders.findMany({
        orderBy: { created_at: 'desc' },
        take: 20,
      });
      const orders = rows.map(mapPayloadOrderToRow).filter((o): o is NonNullable<typeof o> => Boolean(o));

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

      // Step B: Persist order in Payload CMS Orders collection
      await tx.cms_orders.create({
        data: {
          order_id: orderId,
          status: 'Order_Received___Verified',
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
          estimated_delivery: estimatedDelivery ?? deliveryDate ?? 'Tomorrow',
          slot: slot ?? deliverySlot ?? 'Morning (9 AM - 1 PM)',
          items: itemsToSave as any,
          items_json: JSON.stringify(itemsToSave),
          payment_method: 'direct',
          payment_status: 'paid',
          tracking_token: trackingToken,
        },
      });

      // Step C: Persist unguessable tracking token securely in payload_kv
      await tx.payload_kv.upsert({
        where: { key: `order_token:${orderId}` },
        create: {
          key: `order_token:${orderId}`,
          data: { orderId, trackingToken, createdAt: new Date().toISOString() },
        },
        update: {
          data: { orderId, trackingToken, createdAt: new Date().toISOString() },
        },
      });

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
