import { getPayload } from 'payload';
import config from '../payload.config';
import fs from 'fs';
import path from 'path';
import {
  PRODUCTS,
  CATEGORIES,
  VASE_OPTIONS,
  GIFT_ADDONS,
} from '../lib/data';

async function migrateData() {
  console.log('🌸 Starting Floralux Phase 4.3 Data Migration into Payload CMS...');
  console.log(`Source data: ${PRODUCTS.length} products, ${CATEGORIES.length} categories, ${VASE_OPTIONS.length} vases, ${GIFT_ADDONS.length} addons`);

  const payload = await getPayload({ config });

  // ---------------------------------------------------------------------------
  // 1. Migrate Media Assets (SVGs)
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 1: Migrating Media Assets ---');
  const mediaMap: Record<string, number> = {};

  const flowerFiles = [
    { filename: 'roses.svg', path: 'public/images/flowers/roses.svg', alt: 'Velvet Scarlet Grand Roses' },
    { filename: 'peonies.svg', path: 'public/images/flowers/peonies.svg', alt: 'Provence Peach Peony Whisper' },
    { filename: 'sunflowers.svg', path: 'public/images/flowers/sunflowers.svg', alt: 'Sunlit Tuscany Meadow' },
    { filename: 'lilies.svg', path: 'public/images/flowers/lilies.svg', alt: 'Celestial White Lily Symphony' },
    { filename: 'tulips.svg', path: 'public/images/flowers/tulips.svg', alt: 'Amsterdam Dawn Pastel Tulips' },
    { filename: 'dried.svg', path: 'public/images/flowers/dried.svg', alt: 'Boho Golden Dune Everlasting' },
    { filename: 'orchids.svg', path: 'public/images/flowers/orchids.svg', alt: 'Royal Magenta Phalaenopsis Orchid' },
    { filename: 'garden.svg', path: 'public/images/flowers/garden.svg', alt: 'Enchanted English Garden Romance' },
    { filename: 'glass.svg', path: 'public/images/vases/glass.svg', alt: 'Fluted Crystal Glass Vase' },
    { filename: 'ceramic.svg', path: 'public/images/vases/ceramic.svg', alt: 'Matte Cream Sculpted Ceramic Vase' },
    { filename: 'brass.svg', path: 'public/images/vases/brass.svg', alt: 'Heritage Antique Brass Vase' },
    { filename: 'burlap.svg', path: 'public/images/vases/burlap.svg', alt: 'Wrapped in Craft Burlap & Ribbon' },
  ];

  for (const item of flowerFiles) {
    const fullPath = path.resolve(process.cwd(), item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠️ File not found: ${fullPath}`);
      continue;
    }

    // Check if media already exists
    const existing = await payload.find({
      collection: 'media',
      where: {
        filename: { equals: item.filename },
      },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      console.log(`  Existing Media: ${item.filename} (ID: ${existing.docs[0].id})`);
      mediaMap[item.filename] = existing.docs[0].id;
    } else {
      const buffer = fs.readFileSync(fullPath);
      const doc = await payload.create({
        collection: 'media',
        data: {
          alt: item.alt,
          caption: item.alt,
        },
        file: {
          data: buffer,
          name: item.filename,
          mimetype: 'image/svg+xml',
          size: buffer.length,
        },
      });
      console.log(`  Uploaded Media: ${item.filename} (ID: ${doc.id})`);
      mediaMap[item.filename] = doc.id;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Migrate Categories (Excluding UI pseudo-category 'all')
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 2: Migrating Categories ---');
  const categoryMap: Record<string, number> = {};
  const activeCategories = CATEGORIES.filter((c) => c.id !== 'all');

  let sortOrder = 10;
  for (const cat of activeCategories) {
    const existing = await payload.find({
      collection: 'categories',
      where: {
        slug: { equals: cat.id },
      },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      const doc = existing.docs[0];
      await payload.update({
        collection: 'categories',
        id: doc.id,
        data: {
          name: cat.name,
          icon: cat.icon,
          isActive: true,
          sortOrder,
        },
      });
      console.log(`  Updated Category: ${cat.name} (ID: ${doc.id}, Slug: ${cat.id})`);
      categoryMap[cat.id] = doc.id;
    } else {
      const doc = await payload.create({
        collection: 'categories',
        data: {
          name: cat.name,
          slug: cat.id,
          icon: cat.icon,
          description: `Handcrafted artisanal bouquets curated for ${cat.name.toLowerCase()}.`,
          isActive: true,
          sortOrder,
        },
      });
      console.log(`  Created Category: ${cat.name} (ID: ${doc.id}, Slug: ${cat.id})`);
      categoryMap[cat.id] = doc.id;
    }
    sortOrder += 10;
  }

  // ---------------------------------------------------------------------------
  // 3. Migrate Vases & Addons into Addons Collection
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 3: Migrating Vases and Add-ons ---');
  const addonIds: number[] = [];

  // Vases
  const vaseSpecs: Record<string, { material: string; dimensions: string; imageFile: string }> = {
    'fluted-glass': {
      material: 'Hand-blown Borosilicate Crystal Glass',
      dimensions: 'Height: 24cm, Diameter: 12cm',
      imageFile: 'glass.svg',
    },
    'sculpted-ceramic': {
      material: 'Matte Glazed Ceramic Stoneware',
      dimensions: 'Height: 26cm, Diameter: 14cm',
      imageFile: 'ceramic.svg',
    },
    'brass-urn': {
      material: 'Heritage Antique Brushed Brass',
      dimensions: 'Height: 28cm, Diameter: 15cm',
      imageFile: 'brass.svg',
    },
  };

  for (const v of VASE_OPTIONS) {
    if (v.id === 'no-vase') continue; // Standard zero-cost burlap packaging option in UI

    const existing = await payload.find({
      collection: 'addons',
      where: {
        slug: { equals: v.id },
      },
      limit: 1,
    });

    const spec = vaseSpecs[v.id];
    const imageId = spec?.imageFile ? mediaMap[spec.imageFile] : undefined;

    const addonData = {
      name: v.name,
      slug: v.id,
      category: 'vase' as const,
      price: v.price,
      stockQuantity: 50,
      stockStatus: 'in_stock' as const,
      isActive: true,
      material: spec?.material || 'Handcrafted Glass/Ceramic',
      dimensions: spec?.dimensions || 'Standard Bouquet Height',
      image: imageId,
      description: `Artisanal vase vessel designed to complement Floralux hand-tied bouquets.`,
    };

    if (existing.docs.length > 0) {
      const doc = existing.docs[0];
      await payload.update({
        collection: 'addons',
        id: doc.id,
        data: addonData,
      });
      console.log(`  Updated Vase Addon: ${v.name} (ID: ${doc.id})`);
      addonIds.push(doc.id);
    } else {
      const doc = await payload.create({
        collection: 'addons',
        data: addonData,
      });
      console.log(`  Created Vase Addon: ${v.name} (ID: ${doc.id})`);
      addonIds.push(doc.id);
    }
  }

  // Gifts
  const giftCategories: Record<string, 'chocolate' | 'candle' | 'plush' | 'gift-set'> = {
    chocolates: 'chocolate',
    candle: 'candle',
    'plush-bear': 'plush',
    'plant-food': 'gift-set',
  };

  for (const g of GIFT_ADDONS) {
    const existing = await payload.find({
      collection: 'addons',
      where: {
        slug: { equals: g.id },
      },
      limit: 1,
    });

    const addonData = {
      name: g.name,
      slug: g.id,
      category: giftCategories[g.id] || 'gift-set',
      price: g.price,
      icon: g.icon,
      stockQuantity: 100,
      stockStatus: 'in_stock' as const,
      isActive: true,
      description: `Premium gift add-on curated for special floral celebrations.`,
    };

    if (existing.docs.length > 0) {
      const doc = existing.docs[0];
      await payload.update({
        collection: 'addons',
        id: doc.id,
        data: addonData,
      });
      console.log(`  Updated Gift Addon: ${g.name} (ID: ${doc.id})`);
      addonIds.push(doc.id);
    } else {
      const doc = await payload.create({
        collection: 'addons',
        data: addonData,
      });
      console.log(`  Created Gift Addon: ${g.name} (ID: ${doc.id})`);
      addonIds.push(doc.id);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Migrate Products
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 4: Migrating Products ---');
  let migratedProductsCount = 0;

  for (const p of PRODUCTS) {
    const categoryId = categoryMap[p.category];
    if (!categoryId) {
      throw new Error(`Category not found for product "${p.name}": ${p.category}`);
    }

    // Extract filename from image path (e.g. '/images/flowers/roses.svg' -> 'roses.svg')
    const imageFilename = path.basename(p.image);
    const mediaId = mediaMap[imageFilename];

    const existing = await payload.find({
      collection: 'products',
      where: {
        slug: { equals: p.slug },
      },
      limit: 1,
    });

    const productData = {
      name: p.name,
      slug: p.slug,
      sku: p.id.toUpperCase(),
      tagline: p.tagline,
      shortDescription: p.tagline,
      description: p.description,
      category: categoryId,
      categories: [categoryId],
      tags: ['roses', 'vibrant', 'same-day'] as any, // Curated tags
      price: p.price,
      compareAtPrice: p.originalPrice,
      stockQuantity: 100,
      stockStatus: 'in_stock' as const,
      flowerType: p.flowerType,
      stemCount: p.stemCount,
      occasions: p.occasion as any,
      symbolism: p.symbolism,
      careTips: p.careTips.map((tip) => ({ tip })),
      sizes: p.sizes.map((s) => ({
        name: s.name,
        price: s.price,
        multiplier: s.multiplier,
      })),
      featuredImage: mediaId,
      isFeatured: p.isBestseller || p.isNew,
      isBestseller: p.isBestseller,
      isNew: p.isNew,
      status: 'published' as const,
      rating: p.rating,
      reviewCount: p.reviewCount,
      suggestedAddons: addonIds,
      metaTitle: `${p.name} | FloraLux Luxury Florist`,
      metaDescription: p.tagline,
    };

    if (existing.docs.length > 0) {
      const doc = existing.docs[0];
      await payload.update({
        collection: 'products',
        id: doc.id,
        data: productData,
      });
      console.log(`  Updated Product: ${p.name} (ID: ${doc.id}, Slug: ${p.slug})`);
    } else {
      const doc = await payload.create({
        collection: 'products',
        data: productData,
      });
      console.log(`  Created Product: ${p.name} (ID: ${doc.id}, Slug: ${p.slug})`);
    }
    migratedProductsCount++;
  }

  // ---------------------------------------------------------------------------
  // 5. Migrate Site Settings Global
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 5: Seeding Site Settings Global ---');
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      storeName: 'FloraLux Luxury Florist',
      tagline: 'Artisanal Blooms Handcrafted in India',
      currency: 'INR',
      currencySymbol: '₹',
      contactEmail: 'concierge@floralux.in',
      contactPhone: '+91 98765 43210',
      address: 'Bandra West, Mumbai, Maharashtra 400050',
      freeShippingThreshold: 2999,
      standardShippingFee: 149,
      expressDeliveryFee: 299,
      announcementBar: {
        enabled: true,
        text: 'Fresh Farm Blooms Cut Sunrise Daily • Same-Day Hand Delivery Before 2 PM • Use Code SPRING20 for 20% Off',
        link: '/flowers',
      },
      defaultMetaTitle: 'FloraLux | Luxury Flower Delivery & Artisanal Fresh Blooms',
      defaultMetaDescription:
        'Send handcrafted fresh bouquets, long-stem Ecuadorian roses, peonies, and everlasting florals with same-day delivery.',
    },
  });
  console.log('  Site settings configured.');

  // ---------------------------------------------------------------------------
  // Verification Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== MIGRATION VERIFICATION ===');
  const totalProducts = await payload.count({ collection: 'products' });
  const totalCategories = await payload.count({ collection: 'categories' });
  const totalAddons = await payload.count({ collection: 'addons' });
  const totalMedia = await payload.count({ collection: 'media' });

  console.log(`Source Products: ${PRODUCTS.length}  --> Destination cms_products: ${totalProducts.totalDocs}`);
  console.log(`Source Categories: ${activeCategories.length} --> Destination cms_categories: ${totalCategories.totalDocs}`);
  console.log(`Source Vases/Gifts: 7 --> Destination cms_addons: ${totalAddons.totalDocs}`);
  console.log(`Destination Media: ${totalMedia.totalDocs}`);

  if (totalProducts.totalDocs !== PRODUCTS.length) {
    throw new Error(`Product count mismatch: expected ${PRODUCTS.length}, found ${totalProducts.totalDocs}`);
  }
  if (totalCategories.totalDocs !== activeCategories.length) {
    throw new Error(`Category count mismatch: expected ${activeCategories.length}, found ${totalCategories.totalDocs}`);
  }

  console.log('\n✨ Phase 4.3 Data Migration Succeeded with 100% Integrity!');
  process.exit(0);
}

migrateData().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
