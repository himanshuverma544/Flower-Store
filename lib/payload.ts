import { getPayload, Payload } from 'payload';
import config from '@payload-config';
import { unstable_cache } from 'next/cache';
import { Product, Category, VaseOption, GiftAddon } from '@/types';

let cachedPayload: Payload | null = null;

export async function getPayloadClient(): Promise<Payload> {
  if (cachedPayload) return cachedPayload;
  try {
    cachedPayload = await getPayload({ config });
    return cachedPayload;
  } catch (err: any) {
    console.error('❌ [Floralux CMS Error]: Failed to initialize Payload CMS client:', err.message || err);
    throw new Error(`Payload CMS client connection failed: ${err.message || 'Unknown database error'}`);
  }
}

/**
 * Normalizes a Payload CMS Product document into the storefront's expected Product interface.
 */
export function mapPayloadProduct(doc: any): Product {
  const categorySlug =
    typeof doc.category === 'object' && doc.category !== null
      ? doc.category.slug
      : String(doc.category || 'luxury');

  // Featured image resolution: use URL from populated media, or fallback to local path
  let imageUrl = '/images/flowers/roses.svg';
  if (typeof doc.featuredImage === 'object' && doc.featuredImage !== null) {
    imageUrl = doc.featuredImage.url || `/images/flowers/${doc.featuredImage.filename}`;
  } else if (typeof doc.featuredImage === 'string') {
    imageUrl = doc.featuredImage;
  } else if (doc.slug) {
    imageUrl = `/images/flowers/${doc.slug}.svg`;
  }

  // Gallery resolution
  let gallery: string[] = [imageUrl];
  if (Array.isArray(doc.gallery) && doc.gallery.length > 0) {
    gallery = doc.gallery.map((g: any) => {
      if (typeof g === 'object' && g !== null) {
        return g.url || `/images/flowers/${g.filename}`;
      }
      return String(g);
    });
  }

  return {
    id: String(doc.sku || `fl-${doc.id}`),
    slug: doc.slug,
    name: doc.name,
    tagline: doc.tagline,
    price: Number(doc.price),
    originalPrice: Number(doc.compareAtPrice || doc.price),
    category: categorySlug,
    occasion: Array.isArray(doc.occasions) ? doc.occasions : [],
    flowerType: doc.flowerType,
    stemCount: Number(doc.stemCount || 12),
    rating: Number(doc.rating || 5.0),
    reviewCount: Number(doc.reviewCount || 0),
    isBestseller: Boolean(doc.isBestseller),
    isNew: Boolean(doc.isNew),
    image: imageUrl,
    gallery: gallery.length > 0 ? gallery : [imageUrl],
    symbolism: doc.symbolism || '',
    description: doc.description || '',
    careTips: Array.isArray(doc.careTips)
      ? doc.careTips.map((c: any) => (typeof c === 'string' ? c : c.tip))
      : [],
    sizes: Array.isArray(doc.sizes)
      ? doc.sizes.map((s: any) => ({
          name: s.name,
          price: Number(s.price),
          multiplier: Number(s.multiplier || 1),
        }))
      : [{ name: 'Standard', price: Number(doc.price), multiplier: 1 }],
  };
}

// -----------------------------------------------------------------------------
// 1. Products Getters
// -----------------------------------------------------------------------------
async function fetchStorefrontProducts(): Promise<Product[]> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'products',
      where: {
        status: { equals: 'published' },
      },
      depth: 2,
      limit: 100,
      sort: '-createdAt',
    });

    return result.docs.map(mapPayloadProduct);
  } catch (error: any) {
    console.error('❌ [Floralux CMS Service Error]: Failed to fetch products:', error.message || error);
    throw error;
  }
}

const cachedStorefrontProducts = unstable_cache(
  fetchStorefrontProducts,
  ['storefront-products-list'],
  { tags: ['products'], revalidate: 60 }
);

export async function getStorefrontProducts(): Promise<Product[]> {
  try {
    return await cachedStorefrontProducts();
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchStorefrontProducts();
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 2. Single Product Getter
// -----------------------------------------------------------------------------
async function fetchStorefrontProductBySlug(slug: string): Promise<Product | null> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'products',
      where: {
        slug: { equals: slug },
        status: { equals: 'published' },
      },
      depth: 2,
      limit: 1,
    });

    if (!result.docs || result.docs.length === 0) {
      return null;
    }

    return mapPayloadProduct(result.docs[0]);
  } catch (error: any) {
    console.error(`❌ [Floralux CMS Service Error]: Failed to fetch product for slug "${slug}":`, error.message || error);
    throw error;
  }
}

const cachedStorefrontProductBySlug = (slug: string) =>
  unstable_cache(
    () => fetchStorefrontProductBySlug(slug),
    [`storefront-product-${slug}`],
    { tags: ['products', `product-${slug}`], revalidate: 60 }
  )();

export async function getStorefrontProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await cachedStorefrontProductBySlug(slug);
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchStorefrontProductBySlug(slug);
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 3. Categories Getter
// -----------------------------------------------------------------------------
async function fetchStorefrontCategories(): Promise<Category[]> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'categories',
      where: {
        isActive: { equals: true },
      },
      sort: 'sortOrder',
      limit: 50,
    });

    return [
      { id: 'all', name: 'All Blooms', icon: 'Sparkles' },
      ...result.docs.map((doc: any) => ({
        id: doc.slug,
        name: doc.name,
        icon: doc.icon || 'Sparkles',
      })),
    ];
  } catch (error: any) {
    console.error('❌ [Floralux CMS Service Error]: Failed to fetch categories:', error.message || error);
    throw error;
  }
}

const cachedStorefrontCategories = unstable_cache(
  fetchStorefrontCategories,
  ['storefront-categories-list'],
  { tags: ['categories'], revalidate: 60 }
);

export async function getStorefrontCategories(): Promise<Category[]> {
  try {
    return await cachedStorefrontCategories();
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchStorefrontCategories();
    }
    throw err;
  }
}

export interface AddonsData {
  vases: VaseOption[];
  gifts: GiftAddon[];
  giftAddons: GiftAddon[];
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressDeliveryFee: number;
  announcementBar?: {
    enabled?: boolean | null;
    text?: string | null;
    link?: string | null;
  } | null;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
}

// -----------------------------------------------------------------------------
// 4. Add-ons & Vases Getter
// -----------------------------------------------------------------------------
async function fetchStorefrontAddons(): Promise<AddonsData> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'addons',
      where: {
        isActive: { equals: true },
      },
      depth: 1,
      limit: 100,
      sort: 'sortOrder',
    });

    const vases: VaseOption[] = [
      {
        id: 'no-vase',
        name: 'Wrapped in Craft Burlap & Ribbon (No Vase)',
        price: 0,
        image: '/images/vases/burlap.svg',
      },
    ];

    const gifts: GiftAddon[] = [];

    for (const doc of result.docs as any[]) {
      if (doc.category === 'vase') {
        let imageUrl = '/images/vases/glass.svg';
        if (doc.image && typeof doc.image === 'object' && doc.image.url) {
          imageUrl = doc.image.url;
        } else if (doc.slug) {
          imageUrl = `/images/vases/${doc.slug}.svg`;
        }
        vases.push({
          id: doc.slug,
          name: doc.name,
          price: Number(doc.price),
          image: imageUrl,
        });
      } else {
        gifts.push({
          id: doc.slug,
          name: doc.name,
          price: Number(doc.price),
          icon: doc.icon || 'Gift',
        });
      }
    }

    return { vases, gifts, giftAddons: gifts };
  } catch (error: any) {
    console.error('❌ [Floralux CMS Service Error]: Failed to fetch addons:', error.message || error);
    throw error;
  }
}

const cachedStorefrontAddons = unstable_cache(
  fetchStorefrontAddons,
  ['storefront-addons-list'],
  { tags: ['addons'], revalidate: 60 }
);

export async function getStorefrontAddons(): Promise<AddonsData> {
  try {
    return await cachedStorefrontAddons();
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchStorefrontAddons();
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 5. Site Settings Getter
// -----------------------------------------------------------------------------
async function fetchStorefrontSiteSettings(): Promise<SiteSettings> {
  try {
    const payload = await getPayloadClient();
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
    });

    return {
      storeName: settings.storeName || 'FloraLux Luxury Florist',
      tagline: settings.tagline || 'Artisanal Blooms Handcrafted in India',
      currency: settings.currency || 'INR',
      currencySymbol: settings.currencySymbol || '₹',
      contactEmail: settings.contactEmail || 'concierge@floralux.in',
      contactPhone: settings.contactPhone || '+91 98765 43210',
      address: settings.address || 'Bandra West, Mumbai, Maharashtra 400050',
      freeShippingThreshold: Number(settings.freeShippingThreshold || 2999),
      standardShippingFee: Number(settings.standardShippingFee || 149),
      expressDeliveryFee: Number(settings.expressDeliveryFee || 299),
      announcementBar: settings.announcementBar || {
        enabled: true,
        text: 'Fresh Farm Blooms Cut Sunrise Daily • Same-Day Hand Delivery Before 2 PM • Use Code SPRING20 for 20% Off',
        link: '/flowers',
      },
      defaultMetaTitle: settings.defaultMetaTitle || 'FloraLux | Luxury Flower Delivery & Artisanal Fresh Blooms',
      defaultMetaDescription: settings.defaultMetaDescription || 'Send handcrafted fresh bouquets with same-day delivery.',
    };
  } catch (error: any) {
    console.error('❌ [Floralux CMS Service Error]: Failed to fetch site settings:', error.message || error);
    throw error;
  }
}

const cachedStorefrontSiteSettings = unstable_cache(
  fetchStorefrontSiteSettings,
  ['storefront-site-settings'],
  { tags: ['site-settings'], revalidate: 60 }
);

export async function getStorefrontSiteSettings(): Promise<SiteSettings> {
  try {
    return await cachedStorefrontSiteSettings();
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchStorefrontSiteSettings();
    }
    throw err;
  }
}
