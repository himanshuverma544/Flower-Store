import type { GlobalConfig } from 'payload';
import { isAdmin, isStaff } from '../collections/access';

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  dbName: 'cms_site_settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true, // Storefront can read public settings
    update: isAdmin,  // Only admins can update site settings
  },
  hooks: {
    afterChange: [
      async () => {
        try {
          const { revalidateTag } = await import('next/cache');
          revalidateTag('site-settings');
        } catch {
          // Ignore outside Next.js request context
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Store & Contact',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'storeName',
                  type: 'text',
                  required: true,
                  defaultValue: 'Floralux Luxury Florist',
                  admin: {
                    width: '50%',
                    description: 'Public storefront brand name.',
                  },
                },
                {
                  name: 'tagline',
                  type: 'text',
                  defaultValue: 'Artisanal Blooms Handcrafted in India',
                  admin: {
                    width: '50%',
                    description: 'Brand tagline or motto.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'currency',
                  type: 'text',
                  defaultValue: 'INR',
                  admin: {
                    width: '50%',
                    readOnly: true,
                    description: 'Store currency code (locked to INR).',
                  },
                },
                {
                  name: 'currencySymbol',
                  type: 'text',
                  defaultValue: '₹',
                  admin: {
                    width: '50%',
                    readOnly: true,
                    description: 'Currency symbol.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'contactEmail',
                  type: 'text',
                  defaultValue: 'concierge@floralux.in',
                  admin: {
                    width: '50%',
                    description: 'Customer service email address.',
                  },
                },
                {
                  name: 'contactPhone',
                  type: 'text',
                  defaultValue: '+91 98765 43210',
                  admin: {
                    width: '50%',
                    description: 'Concierge phone / helpline.',
                  },
                },
              ],
            },
            {
              name: 'address',
              type: 'textarea',
              defaultValue: 'Bandra West, Mumbai, Maharashtra 400050',
              admin: {
                description: 'Flagship studio physical address.',
              },
            },
          ],
        },
        {
          label: 'Shipping & Delivery',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'freeShippingThreshold',
                  type: 'number',
                  defaultValue: 2999,
                  min: 0,
                  validate: (val: any) => {
                    if (val !== undefined && val !== null) {
                      if (!Number.isInteger(Number(val))) return 'Threshold must be a whole integer in INR';
                      if (Number(val) < 0) return 'Threshold cannot be negative';
                    }
                    return true;
                  },
                  admin: {
                    width: '33%',
                    description: 'Minimum cart subtotal in ₹ INR for free delivery.',
                  },
                },
                {
                  name: 'standardShippingFee',
                  type: 'number',
                  defaultValue: 149,
                  min: 0,
                  validate: (val: any) => {
                    if (val !== undefined && val !== null) {
                      if (!Number.isInteger(Number(val))) return 'Shipping fee must be a whole integer in INR';
                      if (Number(val) < 0) return 'Shipping fee cannot be negative';
                    }
                    return true;
                  },
                  admin: {
                    width: '33%',
                    description: 'Standard courier delivery fee in ₹ INR.',
                  },
                },
                {
                  name: 'expressDeliveryFee',
                  type: 'number',
                  defaultValue: 299,
                  min: 0,
                  validate: (val: any) => {
                    if (val !== undefined && val !== null) {
                      if (!Number.isInteger(Number(val))) return 'Express delivery fee must be a whole integer in INR';
                      if (Number(val) < 0) return 'Express delivery fee cannot be negative';
                    }
                    return true;
                  },
                  admin: {
                    width: '33%',
                    description: 'Same-day express delivery fee in ₹ INR.',
                  },
                },
              ],
            },
            {
              name: 'announcementBar',
              type: 'group',
              label: 'Announcement Bar',
              fields: [
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    description: 'Display top announcement banner on storefront.',
                  },
                },
                {
                  name: 'text',
                  type: 'text',
                  defaultValue: 'Complimentary luxury gift box & handwritten message card with every order',
                  admin: {
                    description: 'Banner headline text.',
                  },
                },
                {
                  name: 'link',
                  type: 'text',
                  defaultValue: '/catalog',
                  admin: {
                    description: 'Banner destination link.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Social & Concierge',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'instagram',
                  type: 'text',
                  defaultValue: 'https://instagram.com/floralux',
                  admin: {
                    width: '50%',
                    description: 'Instagram profile link.',
                  },
                },
                {
                  name: 'whatsapp',
                  type: 'text',
                  defaultValue: 'https://wa.me/919876543210',
                  admin: {
                    width: '50%',
                    description: 'WhatsApp concierge chat link.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'facebook',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Facebook page link.',
                  },
                },
                {
                  name: 'pinterest',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Pinterest profile link.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Default SEO',
          fields: [
            {
              name: 'defaultMetaTitle',
              type: 'text',
              defaultValue: 'Floralux | Luxury Flower Delivery Across India',
              admin: {
                description: 'Default browser title and Open Graph title.',
              },
            },
            {
              name: 'defaultMetaDescription',
              type: 'textarea',
              defaultValue: 'Experience artisanal floral arrangements, luxury rose bouquets, and same-day delivery across India with Floralux.',
              admin: {
                description: 'Default search engine and social preview description.',
              },
            },
            {
              name: 'defaultShareImage',
              type: 'relationship',
              relationTo: 'media',
              admin: {
                description: 'Default social media fallback image.',
              },
            },
          ],
        },
      ],
    },
  ],
};
