import type { CollectionConfig } from 'payload';
import { publicReadStaffWrite } from './access';

export const Media: CollectionConfig = {
  slug: 'media',
  dbName: 'cms_media',
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'createdAt'],
    group: 'Content',
  },
  access: publicReadStaffWrite,
  upload: {
    disableLocalStorage: true,
    adminThumbnail: 'thumbnail',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 600,
        height: 750,
        position: 'centre',
      },
      {
        name: 'full',
        width: 1200,
        height: 1500,
        position: 'centre',
      },
    ],
    mimeTypes: ['image/*'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Descriptive text for accessibility and search engines.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption to display with the image.',
      },
    },
  ],
};
