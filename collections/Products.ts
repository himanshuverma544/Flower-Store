import type { CollectionConfig } from 'payload';
import { publicReadStaffWrite } from './access';

export const Products: CollectionConfig = {
  slug: 'products',
  dbName: 'cms_products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'category', 'status', 'stockStatus', 'isFeatured', 'isBestseller', 'updatedAt'],
    group: 'Catalog',
  },
  access: publicReadStaffWrite,
  hooks: {
    afterChange: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('products');
        } catch {
          // Ignore when outside Next.js request context
        }
      },
    ],
    afterDelete: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('products');
        } catch {
          // Ignore when outside Next.js request context
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              admin: {
                description: 'Full arrangement name (e.g., Velvet Scarlet Grand Roses).',
              },
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              hooks: {
                beforeValidate: [
                  ({ value, data }) => {
                    if (value) {
                      return String(value)
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '');
                    }
                    if (data?.name) {
                      return String(data.name)
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '');
                    }
                    return value;
                  },
                ],
              },
              admin: {
                description: 'Unique URL slug matching existing storefront routes (e.g., velvet-scarlet-grand-roses).',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'sku',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Stock Keeping Unit or internal bouquet reference (e.g., FL-01).',
                  },
                },
                {
                  name: 'tagline',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Short promotional tagline displayed on product cards and headers.',
                  },
                },
              ],
            },
            {
              name: 'shortDescription',
              type: 'textarea',
              admin: {
                description: 'Brief product summary for catalog lists and quick-view modals.',
              },
            },
            {
              name: 'description',
              type: 'textarea',
              required: true,
              admin: {
                description: 'Detailed floral description, origin of blooms, and styling notes.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'category',
                  type: 'relationship',
                  relationTo: 'categories',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Primary product category.',
                  },
                },
                {
                  name: 'categories',
                  type: 'relationship',
                  relationTo: 'categories',
                  hasMany: true,
                  admin: {
                    width: '50%',
                    description: 'Additional category relationships for cross-merchandising.',
                  },
                },
              ],
            },
            {
              name: 'tags',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Roses', value: 'roses' },
                { label: 'Exotic & Rare', value: 'exotic' },
                { label: 'Pastel Palette', value: 'pastel' },
                { label: 'Vibrant Blooms', value: 'vibrant' },
                { label: 'Fragrant', value: 'fragrant' },
                { label: 'Long Lasting', value: 'long-lasting' },
                { label: 'Same Day Delivery', value: 'same-day' },
                { label: 'Limited Edition', value: 'limited-edition' },
                { label: 'Pet Friendly', value: 'pet-friendly' },
              ],
              admin: {
                description: 'Product filtering and merchandising tags.',
              },
            },
          ],
        },
        {
          label: 'Pricing & Sizes',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'price',
                  type: 'number',
                  required: true,
                  min: 0,
                  validate: (val: any) => {
                    if (val === undefined || val === null) return 'Price is required';
                    if (!Number.isInteger(Number(val))) return 'Price must be a whole integer in INR (e.g. 1799, no decimals)';
                    if (Number(val) < 0) return 'Price cannot be negative';
                    return true;
                  },
                  admin: {
                    width: '50%',
                    description: 'Starting price in whole Indian Rupees (₹), e.g. 1799. Stored as integer.',
                  },
                },
                {
                  name: 'compareAtPrice',
                  type: 'number',
                  min: 0,
                  validate: (val: any) => {
                    if (val !== undefined && val !== null) {
                      if (!Number.isInteger(Number(val))) return 'Compare-at price must be a whole integer in INR';
                      if (Number(val) < 0) return 'Compare-at price cannot be negative';
                    }
                    return true;
                  },
                  admin: {
                    width: '50%',
                    description: 'Original strike-through price in whole Indian Rupees (₹), e.g. 2199.',
                  },
                },
              ],
            },
            {
              name: 'sizes',
              type: 'array',
              label: 'Bouquet Volume Options (Sizes)',
              admin: {
                description: 'Stem volume options (e.g., Standard, Deluxe, Grand Luxe) with their specific prices.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'name',
                      type: 'text',
                      required: true,
                      admin: {
                        width: '40%',
                        description: 'e.g. Standard (12 Stems)',
                      },
                    },
                    {
                      name: 'price',
                      type: 'number',
                      required: true,
                      min: 0,
                      validate: (val: any) => {
                        if (val === undefined || val === null) return 'Size price is required';
                        if (!Number.isInteger(Number(val))) return 'Size price must be a whole integer in INR';
                        if (Number(val) < 0) return 'Size price cannot be negative';
                        return true;
                      },
                      admin: {
                        width: '30%',
                        description: 'Price in ₹ INR (integer)',
                      },
                    },
                    {
                      name: 'multiplier',
                      type: 'number',
                      defaultValue: 1,
                      admin: {
                        width: '30%',
                        description: 'Relative size multiplier (e.g. 1.34)',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Inventory',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stockQuantity',
                  type: 'number',
                  defaultValue: 100,
                  min: 0,
                  validate: (val: any) => {
                    if (val !== undefined && val !== null) {
                      if (!Number.isInteger(Number(val))) return 'Stock quantity must be a whole integer';
                      if (Number(val) < 0) return 'Stock quantity cannot be negative';
                    }
                    return true;
                  },
                  admin: {
                    width: '50%',
                    description: 'Available inventory units.',
                  },
                },
                {
                  name: 'stockStatus',
                  type: 'select',
                  options: [
                    { label: 'In Stock', value: 'in_stock' },
                    { label: 'Out of Stock', value: 'out_of_stock' },
                    { label: 'On Backorder', value: 'backorder' },
                  ],
                  defaultValue: 'in_stock',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Current stock availability status.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Floral Details',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'flowerType',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Primary bloom variety (e.g., Roses, Peonies, Sunflowers, Lilies).',
                  },
                },
                {
                  name: 'stemCount',
                  type: 'number',
                  min: 1,
                  defaultValue: 12,
                  admin: {
                    width: '50%',
                    description: 'Default number of hand-tied stems.',
                  },
                },
              ],
            },
            {
              name: 'occasions',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Romance', value: 'Romance' },
                { label: 'Anniversary', value: 'Anniversary' },
                { label: 'Birthday', value: 'Birthday' },
                { label: 'Sympathy', value: 'Sympathy' },
                { label: 'Congratulations', value: 'Congratulations' },
                { label: 'Thank You', value: 'Thank You' },
                { label: 'Just Because', value: 'Just Because' },
              ],
              admin: {
                description: 'Occasions suited for this bouquet.',
              },
            },
            {
              name: 'symbolism',
              type: 'text',
              admin: {
                description: 'Botanical meaning (e.g., Symbolizes enduring devotion and heartfelt romance).',
              },
            },
            {
              name: 'careTips',
              type: 'array',
              label: 'Florist Care Tips',
              fields: [
                {
                  name: 'tip',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Media & Merchandising',
          fields: [
            {
              name: 'featuredImage',
              type: 'relationship',
              relationTo: 'media',
              admin: {
                description: 'Main product photo displayed on catalog cards and page hero.',
              },
            },
            {
              name: 'gallery',
              type: 'relationship',
              relationTo: 'media',
              hasMany: true,
              admin: {
                description: 'Additional arrangement detail photos.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isFeatured',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '25%',
                    description: 'Featured Product.',
                  },
                },
                {
                  name: 'isBestseller',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '25%',
                    description: 'Bestseller Badge.',
                  },
                },
                {
                  name: 'isNew',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '25%',
                    description: 'New Harvest Badge.',
                  },
                },
                {
                  name: 'status',
                  type: 'select',
                  options: [
                    { label: 'Draft', value: 'draft' },
                    { label: 'Published', value: 'published' },
                    { label: 'Archived', value: 'archived' },
                  ],
                  defaultValue: 'draft',
                  required: true,
                  admin: {
                    width: '25%',
                    description: 'Publication status.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'rating',
                  type: 'number',
                  defaultValue: 5,
                  min: 0,
                  max: 5,
                  admin: {
                    width: '50%',
                    description: 'Customer rating average (0 - 5).',
                  },
                },
                {
                  name: 'reviewCount',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  admin: {
                    width: '50%',
                    description: 'Number of customer reviews.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Add-ons & Upsells',
          fields: [
            {
              name: 'suggestedAddons',
              type: 'relationship',
              relationTo: 'addons',
              hasMany: true,
              admin: {
                description: 'Recommended add-ons and compatible vases (vases, chocolates, cards, candles) for this bouquet.',
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              admin: {
                description: 'Custom browser tab title and Open Graph title.',
              },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              admin: {
                description: 'Search engine snippet and social share description.',
              },
            },
          ],
        },
      ],
    },
  ],
};
