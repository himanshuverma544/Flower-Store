import type { CollectionConfig } from 'payload';
import { isAdmin, isStaff, canAccessAdmin } from './access';

export const Users: CollectionConfig = {
  slug: 'users',
  dbName: 'cms_users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'createdAt'],
    group: 'System',
  },
  access: {
    read: isStaff,
    create: isAdmin,
    update: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true;
      // Allow users to update their own profile
      return user?.id === id;
    },
    delete: isAdmin,
    admin: canAccessAdmin,
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Shop Manager', value: 'shop-manager' },
      ],
      defaultValue: 'shop-manager',
      required: true,
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
      },
      admin: {
        description: 'Administrators have full access. Shop managers can manage catalog and content.',
      },
    },
  ],
};
