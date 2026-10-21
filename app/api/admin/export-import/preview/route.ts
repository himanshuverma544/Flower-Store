import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/export-import/auth';
import { validatePackageJson } from '@/lib/export-import/validate';
import { generatePreview } from '@/lib/export-import/import';
import { ImportOptions } from '@/lib/export-import/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/export-import/preview
 * Validates uploaded JSON package and returns an actionable dry-run preview.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { packageData, options } = body;

    if (!packageData) {
      return NextResponse.json(
        { success: false, error: 'Missing packageData in request body.' },
        { status: 400 }
      );
    }

    // 1. Validate structure
    const validation = validatePackageJson(packageData);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Package validation failed.',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const importOptions: ImportOptions = options || {
      mode: 'dry_run',
      collections: {
        media: true,
        categories: true,
        addons: true,
        coupons: true,
        products: true,
        siteSettings: true,
      },
      verifyR2Media: true,
    };

    // 2. Generate preview
    const preview = await generatePreview(validation.packageData!, importOptions);

    return NextResponse.json({
      success: true,
      preview,
      validationWarnings: validation.warnings,
    });
  } catch (err: any) {
    console.error('[Preview Error]:', err);
    return NextResponse.json(
      { success: false, error: `Preview simulation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
