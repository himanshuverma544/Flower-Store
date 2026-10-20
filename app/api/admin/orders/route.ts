import { NextRequest, NextResponse } from 'next/server';
import { executeAuthStrategies, getPayload } from 'payload';
import configPromise from '@payload-config';
import { headers as getHeaders } from 'next/headers';
import { prisma } from '@/lib/db';
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
    items = JSON.parse(order.itemsJson || '[]');
  } catch {
    items = [];
  }

  return {
    id: order.id,
    date: order.date,
    total: order.total,
    status: order.status,
    currentStep: order.currentStep ?? (STATUS_STEP_MAP[order.status] || 1),
    estimatedDelivery: order.estimatedDelivery,
    slot: order.slot,
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
    cardMessage: order.cardMessage || '',
    deliveryDate: order.deliveryDate || '',
    deliverySlot: order.deliverySlot || '',
    items,
    createdAt: order.createdAt,
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

    // Single order detail query
    if (id) {
      const order = await prisma.order.findFirst({
        where: { id: { equals: id.trim(), mode: 'insensitive' } },
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

    // Build Prisma where clause
    const where: any = {};

    // Search filter across ID, recipient, sender, phone
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { senderEmail: { contains: search, mode: 'insensitive' } },
        { recipientPhone: { contains: search, mode: 'insensitive' } },
        { recipientCity: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      // Handle status aliases (e.g. 'Order Received' matches both 'Order Received' and 'Order Received & Verified')
      if (status === 'Order Received') {
        where.status = { in: ['Order Received', 'Order Received & Verified'] };
      } else if (status === 'Out for Delivery') {
        where.status = { in: ['Out for Delivery', 'Out for Hand Delivery'] };
      } else if (status === 'Delivered') {
        where.status = { in: ['Delivered', 'Safely Delivered'] };
      } else if (status === 'Crafting Floral Arrangement') {
        where.status = { in: ['Crafting Floral Arrangement', 'Master Florist Arranging'] };
      } else {
        where.status = { equals: status, mode: 'insensitive' };
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const skip = (page - 1) * limit;

    // Execute count and query concurrently
    const [totalDocs, orders, statusStats] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.groupBy({
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

    statusStats.forEach((s) => {
      statusCounts.all += s._count.status;
      if (s.status.includes('Received') || s.status.includes('Verified')) {
        statusCounts['Order Received'] += s._count.status;
      } else if (s.status.includes('Crafting') || s.status.includes('Arranging')) {
        statusCounts['Crafting Floral Arrangement'] += s._count.status;
      } else if (s.status.includes('Out for')) {
        statusCounts['Out for Delivery'] += s._count.status;
      } else if (s.status.includes('Delivered')) {
        statusCounts['Delivered'] += s._count.status;
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

    // Find the existing order in Prisma
    const existing = await prisma.order.findUnique({
      where: { id: id.trim() },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Update ONLY status, currentStep, and optional delivery slot/eta
    const updateData: any = {
      status: cleanStatus,
      currentStep: targetStep,
    };

    if (estimatedDelivery && typeof estimatedDelivery === 'string') {
      updateData.estimatedDelivery = estimatedDelivery.trim();
    }
    if (slot && typeof slot === 'string') {
      updateData.slot = slot.trim();
    }

    const updated = await prisma.order.update({
      where: { id: id.trim() },
      data: updateData,
    });

    // Structured server-side audit log
    console.log(
      `[Admin Order Audit] Status updated for order ${updated.id} from "${existing.status}" to "${updated.status}" (Step ${updated.currentStep}) by staff "${user.email}" (${user.role}) at ${new Date().toISOString()}`
    );

    return NextResponse.json({
      success: true,
      message: `Order ${updated.id} updated to "${updated.status}"`,
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
