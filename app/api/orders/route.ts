import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CartItem } from '@/types';

// ---- Helpers ----------------------------------------------------------------

function deserializeOrder(order: {
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

// ---- GET --------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

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

      return NextResponse.json({ success: true, order: deserializeOrder(order) });
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      orders: orders.map(deserializeOrder),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ---- POST -------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      items,
      recipient,
      sender,
      cardMessage,
      deliveryDate,
      deliverySlot,
      total,
      subtotal,
      discountAmount,
      shippingFee,
      estimatedDelivery,
      slot,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cart items required' },
        { status: 400 }
      );
    }

    const orderId = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    await prisma.order.create({
      data: {
        id: orderId,
        date: dateStr,
        total: total ?? 0,
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

        itemsJson: JSON.stringify(items),
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      message: 'Flower order placed and reserved successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
