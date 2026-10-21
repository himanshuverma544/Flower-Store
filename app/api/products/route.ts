import { NextRequest, NextResponse } from 'next/server';
import { getStorefrontProducts, getStorefrontProductBySlug } from '@/lib/payload';

// Always run on request — never pre-render at build time (needs the database).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---- GET --------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const occasion = searchParams.get('occasion');
    const query = searchParams.get('q');
    const flowerType = searchParams.get('flowerType');
    const slug = searchParams.get('slug');

    // Single product by slug
    if (slug) {
      const product = await getStorefrontProductBySlug(slug);
      if (!product) {
        return NextResponse.json(
          { success: false, message: 'Product not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: product });
    }

    // Multiple products with filtering
    let products = await getStorefrontProducts();

    if (category && category !== 'all') {
      products = products.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (flowerType && flowerType !== 'All') {
      products = products.filter((p) =>
        p.flowerType.toLowerCase().includes(flowerType.toLowerCase())
      );
    }

    if (query) {
      const q = query.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.flowerType.toLowerCase().includes(q)
      );
    }

    if (occasion && occasion !== 'All') {
      products = products.filter((p) =>
        p.occasion.some((o) => o.toLowerCase() === occasion.toLowerCase())
      );
    }

    return NextResponse.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
