import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cleanupExpiredReservations } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function constantTimeEquals(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, Vercel cron sends `Authorization: Bearer <CRON_SECRET>`
    if (cronSecret) {
      const expectedHeader = `Bearer ${cronSecret}`;
      if (!authHeader || !constantTimeEquals(authHeader, expectedHeader)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Fail safe in production if CRON_SECRET is not configured
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET environment variable is missing in production' },
        { status: 500 }
      );
    }

    const result = await cleanupExpiredReservations({ gracePeriodMinutes: 15 });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Reservation cleanup cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during reservation cleanup' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
