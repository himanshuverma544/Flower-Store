import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Product } from '@/types';

// ---- Helpers ----------------------------------------------------------------

function deserializeProduct(p: {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice: number;
  category: string;
  flowerType: string;
  stemCount: number;
  rating: number;
  reviewCount: number;
  isBestseller: boolean;
  isNew: boolean;
  image: string;
  symbolism: string;
  description: string;
  occasionJson: string;
  galleryJson: string;
  careTipsJson: string;
  sizesJson: string;
}): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    price: p.price,
    originalPrice: p.originalPrice,
    category: p.category,
    flowerType: p.flowerType,
    stemCount: p.stemCount,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isBestseller: p.isBestseller,
    isNew: p.isNew,
    image: p.image,
    symbolism: p.symbolism,
    description: p.description,
    occasion: JSON.parse(p.occasionJson),
    gallery: JSON.parse(p.galleryJson),
    careTips: JSON.parse(p.careTipsJson),
    sizes: JSON.parse(p.sizesJson),
  };
}

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
      const product = await prisma.product.findUnique({ where: { slug } });
      if (!product) {
        return NextResponse.json(
          { success: false, message: 'Product not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: deserializeProduct(product) });
    }

    // Build where filters
    const where: Record<string, unknown> = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (flowerType && flowerType !== 'All') {
      where.flowerType = { contains: flowerType, mode: 'insensitive' };
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { tagline: { contains: query, mode: 'insensitive' } },
        { flowerType: { contains: query, mode: 'insensitive' } },
      ];
    }

    let products = await prisma.product.findMany({ where });

    // Occasion filter — needs post-query filtering since it's stored as JSON
    if (occasion && occasion !== 'All') {
      products = products.filter((p) => {
        const occasions: string[] = JSON.parse(p.occasionJson);
        return occasions.includes(occasion);
      });
    }

    return NextResponse.json({
      success: true,
      count: products.length,
      data: products.map(deserializeProduct),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
