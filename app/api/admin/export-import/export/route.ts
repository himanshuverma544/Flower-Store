import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/export-import/auth';
import { exportCatalog } from '@/lib/export-import/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/export-import/export
 * Generates and returns a downloadable JSON export package.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Allow empty body to export all
    }

    const pkg = await exportCatalog({
      collections: body.collections,
    });

    const filename = `catalog-export-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(pkg, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('[Export Error]:', err);
    return NextResponse.json(
      { success: false, error: `Catalog export failed: ${err.message}` },
      { status: 500 }
    );
  }
}
