import HomeClientView from '@/components/HomeClientView';
import {
  getStorefrontProducts,
  getStorefrontCategories,
  getStorefrontSiteSettings,
} from '@/lib/payload';

export const revalidate = 60;

export default async function HomePage() {
  const [products, categories, siteSettings] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
    getStorefrontSiteSettings(),
  ]);

  return (
    <HomeClientView
      products={products}
      categories={categories}
      siteSettings={siteSettings}
    />
  );
}
