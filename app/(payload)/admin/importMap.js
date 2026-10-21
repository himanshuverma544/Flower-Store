import { ExportImportNavEntry as ExportImportNavEntry_674e78ed2f840b3e888966238e9a1ac5 } from '@/components/admin/ExportImportNavEntry'
import { ExportImportView as ExportImportView_b440d9f8e6f0e6da17f770b078f138d2 } from '@/components/admin/ExportImportView'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/components/admin/ExportImportNavEntry#ExportImportNavEntry": ExportImportNavEntry_674e78ed2f840b3e888966238e9a1ac5,
  "@/components/admin/ExportImportView#ExportImportView": ExportImportView_b440d9f8e6f0e6da17f770b078f138d2,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24
}
