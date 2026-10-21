import { NextRequest, NextResponse } from 'next/server';
import { executeAuthStrategies, getPayload } from 'payload';
import configPromise from '@payload-config';
import { headers as getHeaders } from 'next/headers';
import { prisma } from '@/lib/db';
import { enum_cms_orders_status } from '@prisma/client';
import { CartItem } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Customer-facing delivery statuses & currentStep mapping
 */
const STATUS_STEP_MAP: Record<string, number> = {
  'Order Received': 1,
  'Order Received & Verified': 1,
  'Crafting Floral Arrangement': 2,
  'Master Florist Arranging': 2,
  'Out for Delivery': 3,
  'Out for Hand Delivery': 3,
  'Delivered': 4,
  'Safely Delivered': 4,
};

const CANONICAL_STATUSES = [
  'Order Received',
  'Crafting Floral Arrangement',
  'Out for Delivery',
  'Delivered',
] as const;

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

const DISPLAY_TO_PRISMA_STATUS: Record<string, enum_cms_orders_status> = {
  'Payment Pending': enum_cms_orders_status.Payment_Pending,
  'Order Received & Verified': enum_cms_orders_status.Order_Received___Verified,
  'Order Received': enum_cms_orders_status.Order_Received,
  'Crafting Floral Arrangement': enum_cms_orders_status.Crafting_Floral_Arrangement,
  'Master Florist Arranging': enum_cms_orders_status.Crafting_Floral_Arrangement,
  'Out for Delivery': enum_cms_orders_status.Out_for_Delivery,
  'Out for Hand Delivery': enum_cms_orders_status.Out_for_Delivery,
  'Delivered': enum_cms_orders_status.Delivered,
  'Safely Delivered': enum_cms_orders_status.Delivered,
  'Payment Failed': enum_cms_orders_status.Payment_Failed,
  'Payment Expired': enum_cms_orders_status.Payment_Expired,
  'Cancelled': enum_cms_orders_status.Cancelled,
};

/**
 * Authenticates request using Payload session / token.
 * Only 'admin' and 'shop-manager' roles are permitted.
 */
async function authenticateStaff() {
  try {
    const config = await configPromise;
    const payload = await getPayload({ config });
    const headers = await getHeaders();

    const authRes = await executeAuthStrategies({
      headers,
      payload,
    });

    const user = authRes?.user;

    if (!user) {
      return { error: 'Authentication required. Please log into Payload Admin.', status: 401 };
    }

    if (user.role !== 'admin' && user.role !== 'shop-manager') {
      return { error: 'Access denied: Requires admin or shop-manager role.', status: 403 };
    }

    return { user };
  } catch (err: any) {
    console.error('[Admin Orders Auth Error]:', err);
    return { error: 'Internal authentication error', status: 500 };
  }
}


/**
 * Deserializes a Prisma order record into a clean, safe DTO.
 */
function serializeAdminOrder(order: any) {
  let items: CartItem[] = [];
  try {
    if (order.items && typeof order.items === 'object') {
      items = Array.isArray(order.items) ? order.items : [order.items];
    } else {
      items = JSON.parse(order.itemsJson || order.items_json || '[]');
    }
  } catch {
    items = [];
  }

  const status = normalizeDisplayStatus(order.status);
  const currentStep = order.currentStep ?? order.current_step ?? (STATUS_STEP_MAP[status] || 1);

  return {
    id: order.order_id || order.id,
    date: order.date,
    total: Number(order.total),
    status,
    currentStep: Number(currentStep),
    estimatedDelivery: order.estimatedDelivery || order.estimated_delivery,
    slot: order.slot,
    recipient: {
      fullName: order.recipientName || order.recipient_name,
      address: order.recipientAddress || order.recipient_address,
      phone: order.recipientPhone || order.recipient_phone,
      apt: order.recipientApt || order.recipient_apt,
      city: order.recipientCity || order.recipient_city,
      state: order.recipientState || order.recipient_state,
      zip: order.recipientZip || order.recipient_zip,
      notes: order.recipientNotes || order.recipient_notes,
    },
    sender: {
      senderName: order.senderName || order.sender_name,
      senderEmail: order.senderEmail || order.sender_email,
      senderPhone: order.senderPhone || order.sender_phone,
      keepSecret: Boolean(order.keepSecret ?? order.keep_secret),
    },
    cardMessage: order.cardMessage || order.card_message || '',
    deliveryDate: order.deliveryDate || order.delivery_date || '',
    deliverySlot: order.deliverySlot || order.delivery_slot || '',
    items,
    createdAt: order.createdAt || order.created_at,
  };
}

/**
 * GET /api/admin/orders
 * Returns paginated, searchable, filterable orders for authorized staff.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateStaff();
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single order detail query from Payload CMS Orders
    if (id) {
      const order = await prisma.cms_orders.findFirst({
        where: { order_id: { equals: id.trim(), mode: 'insensitive' } },
      });

      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        order: serializeAdminOrder(order),
      });
    }

    // List query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    // Search filter across ID, recipient, sender, phone, city
    if (search) {
      where.OR = [
        { order_id: { contains: search, mode: 'insensitive' } },
        { recipient_name: { contains: search, mode: 'insensitive' } },
        { sender_name: { contains: search, mode: 'insensitive' } },
        { sender_email: { contains: search, mode: 'insensitive' } },
        { recipient_phone: { contains: search, mode: 'insensitive' } },
        { recipient_city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'Order Received') {
        where.status = {
          in: [
            enum_cms_orders_status.Order_Received,
            enum_cms_orders_status.Order_Received___Verified,
          ],
        };
      } else if (status === 'Out for Delivery') {
        where.status = enum_cms_orders_status.Out_for_Delivery;
      } else if (status === 'Delivered') {
        where.status = enum_cms_orders_status.Delivered;
      } else if (status === 'Crafting Floral Arrangement') {
        where.status = enum_cms_orders_status.Crafting_Floral_Arrangement;
      } else if (DISPLAY_TO_PRISMA_STATUS[status]) {
        where.status = DISPLAY_TO_PRISMA_STATUS[status];
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [totalDocs, orders, statsRes] = await Promise.all([
      prisma.cms_orders.count({ where }),
      prisma.cms_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip,
      }),
      prisma.cms_orders.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const totalPages = Math.ceil(totalDocs / limit);

    // Aggregate counts for quick tabs
    const statusCounts: Record<string, number> = {
      all: 0,
      'Order Received': 0,
      'Crafting Floral Arrangement': 0,
      'Out for Delivery': 0,
      'Delivered': 0,
    };

    statsRes.forEach((s) => {
      const sCount = s._count.status;
      statusCounts.all += sCount;
      const display = normalizeDisplayStatus(s.status);
      if (display.includes('Received') || display.includes('Verified')) {
        statusCounts['Order Received'] += sCount;
      } else if (display.includes('Crafting') || display.includes('Arranging')) {
        statusCounts['Crafting Floral Arrangement'] += sCount;
      } else if (display.includes('Out for')) {
        statusCounts['Out for Delivery'] += sCount;
      } else if (display.includes('Delivered')) {
        statusCounts['Delivered'] += sCount;
      }
    });

    return NextResponse.json({
      success: true,
      orders: orders.map(serializeAdminOrder),
      pagination: {
        page,
        limit,
        totalDocs,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      statusCounts,
    });
  } catch (err: any) {
    console.error('[Admin Orders GET Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve orders. Please check database logs.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/orders
 * Updates customer-facing delivery status and associated metadata for an order.
 * Strictly forbids updating totals, recipient identity, items, or payments.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateStaff();
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { user } = auth;

  try {
    const body = await request.json();
    const { id, status, estimatedDelivery, slot } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid order ID is required' },
        { status: 400 }
      );
    }

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Target delivery status is required' },
        { status: 400 }
      );
    }

    const cleanStatus = status.trim();

    // Validate that the requested status is an approved status
    const targetStep = STATUS_STEP_MAP[cleanStatus];
    if (targetStep === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status "${cleanStatus}". Allowed values: ${CANONICAL_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Find the existing order in payload.cms_orders
    const existing = await prisma.cms_orders.findFirst({
      where: { order_id: { equals: id.trim(), mode: 'insensitive' } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const prismaStatus = DISPLAY_TO_PRISMA_STATUS[cleanStatus] || (cleanStatus as enum_cms_orders_status);

    const updateData: any = {
      status: prismaStatus,
      current_step: targetStep,
    };
    if (estimatedDelivery && typeof estimatedDelivery === 'string') {
      updateData.estimated_delivery = estimatedDelivery.trim();
    }
    if (slot && typeof slot === 'string') {
      updateData.slot = slot.trim();
    }

    const updated = await prisma.cms_orders.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Structured server-side audit log
    console.log(
      `[Admin Order Audit] Status updated for order ${updated.order_id} from "${existing.status}" to "${updated.status}" (Step ${updated.current_step}) by staff "${user.email}" (${user.role}) at ${new Date().toISOString()}`
    );

    return NextResponse.json({
      success: true,
      message: `Order ${updated.order_id} updated to "${normalizeDisplayStatus(updated.status)}"`,
      order: serializeAdminOrder(updated),
    });
  } catch (err: any) {
    console.error('[Admin Orders PATCH Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update delivery status. Please retry.' },
      { status: 500 }
    );
  }
}
