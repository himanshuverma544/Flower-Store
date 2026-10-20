import type { CollectionConfig } from 'payload';
import { staffOnly } from './access';

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  dbName: 'cms_coupons',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'discountType', 'discountValue', 'minSpend', 'isActive', 'endDate', 'usageCount'],
    group: 'Marketing',
  },
  access: staffOnly,
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (typeof value === 'string') {
              return value.toUpperCase().trim().replace(/\s+/g, '');
            }
            return value;
          },
        ],
      },
      admin: {
        description: 'Unique coupon promo code (e.g. LUXE10, WELCOME500). Auto-capitalized.',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Customer-facing offer description (e.g. ₹500 off on first order above ₹2,499).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          type: 'select',
          options: [
            { label: 'Percentage (%)', value: 'percentage' },
            { label: 'Fixed Amount (₹ INR)', value: 'fixed_amount' },
            { label: 'Free Shipping', value: 'free_shipping' },
          ],
          defaultValue: 'percentage',
          required: true,
          admin: {
            width: '50%',
            description: 'Type of discount applied at checkout.',
          },
        },
        {
          name: 'discountValue',
          type: 'number',
          required: true,
          min: 0,
          validate: (val: any, { data }: any) => {
            if (val === undefined || val === null) return 'Discount value is required';
            const num = Number(val);
            if (num < 0) return 'Discount value cannot be negative';
            if (data?.discountType === 'percentage') {
              if (num < 1 || num > 100) return 'Percentage discount must be between 1 and 100%';
            } else if (data?.discountType === 'fixed_amount') {
              if (!Number.isInteger(num)) return 'Fixed discount amount must be a whole integer in INR (no decimals)';
              if (num < 1) return 'Fixed discount amount must be at least ₹1';
            }
            return true;
          },
          admin: {
            width: '50%',
            description: 'Discount percentage (1-100) or whole amount in ₹ INR.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'minSpend',
          type: 'number',
          defaultValue: 0,
          min: 0,
          validate: (val: any) => {
            if (val !== undefined && val !== null) {
              if (!Number.isInteger(Number(val))) return 'Minimum spend must be a whole integer in INR';
              if (Number(val) < 0) return 'Minimum spend cannot be negative';
            }
            return true;
          },
          admin: {
            width: '50%',
            description: 'Minimum cart subtotal in ₹ INR to qualify (0 = no minimum).',
          },
        },
        {
          name: 'maxDiscount',
          type: 'number',
          min: 0,
          validate: (val: any) => {
            if (val !== undefined && val !== null && val !== '') {
              if (!Number.isInteger(Number(val))) return 'Maximum discount cap must be a whole integer in INR';
              if (Number(val) < 0) return 'Maximum discount cap cannot be negative';
            }
            return true;
          },
          admin: {
            width: '50%',
            description: 'Maximum discount ceiling in ₹ INR (especially for percentage coupons; 0 or empty for uncapped).',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startDate',
          type: 'date',
          admin: {
            width: '50%',
            description: 'Start date/time when this coupon becomes active.',
          },
        },
        {
          name: 'endDate',
          type: 'date',
          admin: {
            width: '50%',
            description: 'Expiration date/time after which this coupon cannot be used.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'usageLimitTotal',
          type: 'number',
          min: 0,
          validate: (val: any) => {
            if (val !== undefined && val !== null && val !== '') {
              if (!Number.isInteger(Number(val))) return 'Usage limit must be a whole integer';
              if (Number(val) < 0) return 'Usage limit cannot be negative';
            }
            return true;
          },
          admin: {
            width: '50%',
            description: 'Total times this coupon may be used across all shoppers (blank or 0 for unlimited).',
          },
        },
        {
          name: 'usageLimitPerCustomer',
          type: 'number',
          defaultValue: 1,
          min: 1,
          validate: (val: any) => {
            if (val !== undefined && val !== null) {
              if (!Number.isInteger(Number(val))) return 'Per-customer limit must be a whole integer';
              if (Number(val) < 1) return 'Per-customer limit must be at least 1';
            }
            return true;
          },
          admin: {
            width: '50%',
            description: 'Maximum times a single customer email can redeem this coupon.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '50%',
            description: 'Coupon is active and available for redemption.',
          },
        },
        {
          name: 'usageCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            width: '50%',
            readOnly: true,
            description: 'Total times this coupon has been successfully redeemed.',
          },
        },
      ],
    },
  ],
};
