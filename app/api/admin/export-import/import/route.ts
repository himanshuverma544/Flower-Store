import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/export-import/auth';
import { validatePackageJson } from '@/lib/export-import/validate';
import { executeImport } from '@/lib/export-import/import';
import { ImportOptions } from '@/lib/export-import/types';
import { getDestinationDbInfo } from '@/lib/export-import/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/export-import/import
 * Executes live catalog import with rollback protection and sequence advancement.
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

    const importOptions: ImportOptions = options;
    if (!importOptions || !importOptions.mode) {
      return NextResponse.json(
        { success: false, error: 'Import options with a valid mode are required.' },
        { status: 400 }
      );
    }

    // Production safety check
    const dbInfo = getDestinationDbInfo();
    if (dbInfo.isProduction && importOptions.mode !== 'dry_run') {
      if (importOptions.targetConfirmation !== 'CONFIRM') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Safety Gate: Writing to the PRODUCTION database requires explicit confirmation. Please type "CONFIRM" to proceed.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Execute import
    const result = await executeImport(validation.packageData!, importOptions);

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (err: any) {
    console.error('[Import Execution Error]:', err);
    return NextResponse.json(
      { success: false, error: `Import failed: ${err.message}` },
      { status: 500 }
    );
  }
}
