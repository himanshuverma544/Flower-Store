import type { CollectionConfig } from 'payload';
import { publicReadStaffWrite } from './access';

export const Categories: CollectionConfig = {
  slug: 'categories',
  dbName: 'cms_categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive', 'sortOrder', 'updatedAt'],
    group: 'Catalog',
  },
  access: publicReadStaffWrite,
  hooks: {
    afterChange: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('categories');
        } catch {
          // Ignore when outside Next.js request context
        }
      },
    ],
    afterDelete: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('categories');
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
        description: 'Category display name (e.g., Romance & Anniversary, Grand Luxe Collection).',
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
        description: 'Unique URL slug (e.g., romance, luxury, birthday). Auto-formatted to kebab-case.',
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Lucide icon name (e.g., Heart, Gift, Award, Crown, Sun, Feather, Sparkles).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Short merchandising description of this flower category.',
      },
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Optional category banner or card image.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Active status on the storefront navigation.',
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
