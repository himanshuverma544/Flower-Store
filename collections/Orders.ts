import type { CollectionConfig } from 'payload';
import { staffOnly } from './access';

const STATUS_STEP_MAP: Record<string, number> = {
  'Order Received': 1,
  'Order Received & Verified': 1,
  'Crafting Floral Arrangement': 2,
  'Master Florist Arranging': 2,
  'Out for Delivery': 3,
  'Out for Hand Delivery': 3,
  'Delivered': 4,
  'Safely Delivered': 4,
  'Payment Pending': 1,
  'Payment Failed': 1,
  'Payment Expired': 1,
  'Cancelled': 1,
};

export const Orders: CollectionConfig = {
  slug: 'orders',
  dbName: 'cms_orders',
  admin: {
    useAsTitle: 'orderId',
    defaultColumns: ['orderId', 'status', 'total', 'recipientName', 'senderEmail', 'createdAt'],
    group: 'Commerce',
    pagination: {
      defaultLimit: 20,
    },
  },
  access: staffOnly,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;

        // Auto-generate orderId if missing
        if (!data.orderId) {
          const rand = Math.floor(100000 + Math.random() * 900000);
          data.orderId = `FLX-${rand}`;
        }

        // Auto-generate date string if missing
        if (!data.date) {
          data.date = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        // Auto-calculate currentStep from status if not explicitly given
        if (data.status && STATUS_STEP_MAP[data.status]) {
          data.currentStep = STATUS_STEP_MAP[data.status];
        }

        // Bidirectional sync between items (json) and itemsJson (text)
        if (data.items && (!data.itemsJson || data.itemsJson === '[]')) {
          try {
            data.itemsJson = typeof data.items === 'string' ? data.items : JSON.stringify(data.items);
          } catch {
            // Keep existing
          }
        } else if (data.itemsJson && (!data.items || (Array.isArray(data.items) && data.items.length === 0))) {
          try {
            data.items = typeof data.itemsJson === 'string' ? JSON.parse(data.itemsJson) : data.itemsJson;
          } catch {
            // Keep existing
          }
        }

        return data;
      },
    ],
  },
  fields: [
    {
      name: 'orderId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Human-readable order tracking ID (e.g. FLX-101498).',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview & Status',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'status',
                  type: 'select',
                  required: true,
                  index: true,
                  defaultValue: 'Payment Pending',
                  options: [
                    { label: 'Payment Pending', value: 'Payment Pending' },
                    { label: 'Order Received & Verified', value: 'Order Received & Verified' },
                    { label: 'Order Received', value: 'Order Received' },
                    { label: 'Crafting Floral Arrangement', value: 'Crafting Floral Arrangement' },
                    { label: 'Out for Delivery', value: 'Out for Delivery' },
                    { label: 'Delivered', value: 'Delivered' },
                    { label: 'Payment Failed', value: 'Payment Failed' },
                    { label: 'Payment Expired', value: 'Payment Expired' },
                    { label: 'Cancelled', value: 'Cancelled' },
                  ],
                  admin: {
                    width: '50%',
                  },
                },
                {
                  name: 'currentStep',
                  type: 'number',
                  defaultValue: 1,
                  min: 1,
                  max: 4,
                  admin: {
                    width: '25%',
                    description: 'Tracking bar step (1=Received, 2=Arranging, 3=Out for Delivery, 4=Delivered).',
                  },
                },
                {
                  name: 'date',
                  type: 'text',
                  admin: {
                    width: '25%',
                    description: 'Order placement date display string (e.g. Oct 15, 2026).',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'total',
                  type: 'number',
                  required: true,
                  min: 0,
                  admin: {
                    width: '25%',
                    description: 'Final order total in INR (₹).',
                  },
                },
                {
                  name: 'subtotal',
                  type: 'number',
                  min: 0,
                  admin: {
                    width: '25%',
                    description: 'Cart items subtotal in INR (₹).',
                  },
                },
                {
                  name: 'deliveryFee',
                  type: 'number',
                  min: 0,
                  admin: {
                    width: '25%',
                    description: 'Delivery fee in INR (₹).',
                  },
                },
                {
                  name: 'discount',
                  type: 'number',
                  min: 0,
                  admin: {
                    width: '25%',
                    description: 'Applied coupon discount in INR (₹).',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Customer & Recipient',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'senderName',
                  type: 'text',
                  required: true,
                  admin: { width: '33%' },
                },
                {
                  name: 'senderEmail',
                  type: 'text',
                  required: true,
                  index: true,
                  admin: { width: '33%' },
                },
                {
                  name: 'senderPhone',
                  type: 'text',
                  admin: { width: '33%' },
                },
              ],
            },
            {
              name: 'keepSecret',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Keep sender anonymous from recipient.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'recipientName',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'recipientPhone',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'recipientAddress',
              type: 'text',
              required: true,
            },
            {
              type: 'row',
              fields: [
                { name: 'recipientApt', type: 'text', admin: { width: '25%' } },
                { name: 'recipientCity', type: 'text', admin: { width: '25%' } },
                { name: 'recipientState', type: 'text', admin: { width: '25%' } },
                { name: 'recipientZip', type: 'text', admin: { width: '25%' } },
              ],
            },
            {
              name: 'cardMessage',
              type: 'textarea',
              admin: {
                description: 'Complimentary handwritten gift card message.',
              },
            },
            {
              name: 'recipientNotes',
              type: 'textarea',
              admin: {
                description: 'Delivery driver instructions / gate notes.',
              },
            },
          ],
        },
        {
          label: 'Delivery Schedule',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'deliveryDate',
                  type: 'text',
                  admin: { width: '50%', description: 'Requested delivery date (e.g. Tomorrow or 2026-10-22).' },
                },
                {
                  name: 'deliverySlot',
                  type: 'text',
                  admin: { width: '50%', description: 'Delivery window (e.g. Morning (9 AM - 1 PM)).' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'estimatedDelivery',
                  type: 'text',
                  defaultValue: 'Tomorrow',
                  admin: { width: '50%' },
                },
                {
                  name: 'slot',
                  type: 'text',
                  defaultValue: 'Morning (9 AM - 1 PM)',
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
        {
          label: 'Items & Cart',
          fields: [
            {
              name: 'items',
              type: 'json',
              required: true,
              admin: {
                description: 'Structured order items including size, vase, and add-ons.',
              },
            },
            {
              name: 'itemsJson',
              type: 'text',
              admin: {
                description: 'Raw JSON string representation of cart items for backward compatibility.',
              },
            },
          ],
        },
        {
          label: 'Payment & Gateway',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'paymentMethod',
                  type: 'text',
                  defaultValue: 'razorpay',
                  admin: { width: '50%' },
                },
                {
                  name: 'paymentStatus',
                  type: 'text',
                  defaultValue: 'pending',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'razorpayOrderId',
                  type: 'text',
                  index: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'razorpayPaymentId',
                  type: 'text',
                  index: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'trackingToken',
                  type: 'text',
                  index: true,
                  admin: { width: '50%', description: 'Secure unguessable token for public order tracking.' },
                },
                {
                  name: 'idempotencyKey',
                  type: 'text',
                  index: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'razorpaySignature',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
};
