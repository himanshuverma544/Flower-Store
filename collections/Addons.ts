import type { CollectionConfig } from 'payload';
import { publicReadStaffWrite } from './access';

export const Addons: CollectionConfig = {
  slug: 'addons',
  dbName: 'cms_addons',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'price', 'stockStatus', 'isActive', 'updatedAt'],
    group: 'Catalog',
  },
  access: publicReadStaffWrite,
  hooks: {
    afterChange: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('addons');
        } catch {
          // Ignore when outside Next.js request context
        }
      },
    ],
    afterDelete: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('addons');
        } catch {
          // Ignore when outside Next.js request context
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Gift add-on or vase name (e.g., Fluted Amber Glass Vase, Artisanal Dark Chocolate Truffles).',
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
        description: 'Unique URL slug (e.g., fluted-amber-glass-vase, artisanal-dark-chocolate-truffles). Auto-formatted to kebab-case.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          type: 'select',
          options: [
            { label: 'Vases & Vessels', value: 'vase' },
            { label: 'Chocolates & Sweets', value: 'chocolate' },
            { label: 'Scented Candles', value: 'candle' },
            { label: 'Greeting Cards', value: 'card' },
            { label: 'Balloons', value: 'balloon' },
            { label: 'Plush Toys', value: 'plush' },
            { label: 'Gift Sets & Accessories', value: 'gift-set' },
          ],
          defaultValue: 'vase',
          required: true,
          admin: {
            width: '50%',
            description: 'Item category (vases, chocolates, candles, cards, etc.).',
          },
        },
        {
          name: 'icon',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Lucide icon name (e.g., Flower2, Gift, Heart, Sparkles, Flame).',
          },
        },
      ],
    },
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
            if (!Number.isInteger(Number(val))) return 'Price must be a whole integer in INR (e.g. 599)';
            if (Number(val) < 0) return 'Price cannot be negative';
            return true;
          },
          admin: {
            width: '50%',
            description: 'Price in whole Indian Rupees (₹), e.g. 599. Stored as integer.',
          },
        },
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
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'stockStatus',
          type: 'select',
          options: [
            { label: 'In Stock', value: 'in_stock' },
            { label: 'Out of Stock', value: 'out_of_stock' },
          ],
          defaultValue: 'in_stock',
          required: true,
          admin: {
            width: '50%',
            description: 'Current availability.',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '50%',
            description: 'Visible on the storefront as an add-on or vase option.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'material',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Material or craftsmanship (e.g., Hand-blown Borosilicate Glass, Ceramic Stoneware).',
          },
        },
        {
          name: 'dimensions',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Dimensions (e.g., Height: 24cm, Diameter: 12cm).',
          },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Merchandising description, craftsmanship notes, or ingredient details.',
      },
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Item photo.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Display order (lower numbers appear first).',
      },
    },
  ],
};
