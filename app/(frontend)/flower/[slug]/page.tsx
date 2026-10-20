import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductDetailClientView from '@/components/ProductDetailClientView';
import {
  getStorefrontProducts,
  getStorefrontProductBySlug,
  getStorefrontAddons,
} from '@/lib/payload';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const products = await getStorefrontProducts();
    return products.map((p) => ({ slug: p.slug }));
  } catch (error) {
    console.error('generateStaticParams error:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const flower = await getStorefrontProductBySlug(slug);

  if (!flower) {
    return {
      title: 'Bouquet Not Found | FloraLux',
    };
  }

  return {
    title: `${flower.name} | FloraLux Luxury Florist`,
    description: flower.description,
    openGraph: {
      title: flower.name,
      description: flower.description,
      images: flower.image ? [{ url: flower.image }] : [],
    },
  };
}

export default async function FlowerDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const [flower, addonsData] = await Promise.all([
    getStorefrontProductBySlug(slug),
    getStorefrontAddons(),
  ]);

  if (!flower) {
    return notFound();
  }

  return (
    <ProductDetailClientView
      flower={flower}
      vases={addonsData.vases}
      giftAddons={addonsData.giftAddons}
    />
  );
}
