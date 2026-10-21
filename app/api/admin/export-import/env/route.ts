import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/export-import/auth';
import { getDestinationDbInfo } from '@/lib/export-import/db';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/export-import/env
 * Returns target environment status and current database record counts.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const envInfo = getDestinationDbInfo();

    const [media, categories, addons, coupons, orders, products, siteSettings] = await prisma.$transaction([
      prisma.cms_media.count(),
      prisma.cms_categories.count(),
      prisma.cms_addons.count(),
      prisma.cms_coupons.count(),
      prisma.cms_orders.count(),
      prisma.cms_products.count(),
      prisma.cms_site_settings.count(),
    ]);

    const counts = {
      media,
      categories,
      addons,
      coupons,
      orders,
      products,
      siteSettings,
    };

    return NextResponse.json({
      success: true,
      env: envInfo,
      counts,
    });
  } catch (err: any) {
    console.error('[Export/Import Env GET Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve destination environment status.' },
      { status: 500 }
    );
  }
}
