import { Metadata } from 'next';
import FlowersClientView from '@/components/FlowersClientView';
import { getStorefrontProducts } from '@/lib/payload';

export const metadata: Metadata = {
  title: 'All Handcrafted Bouquets | FloraLux Luxury Florist',
  description:
    'Explore our artisanal farm-fresh floral collection: long-stem roses, ruffled peonies, scented lilies, and sustainable dried stems.',
};

export const revalidate = 60;

export default async function FlowersCatalogPage() {
  const products = await getStorefrontProducts();

  return <FlowersClientView products={products} />;
}
