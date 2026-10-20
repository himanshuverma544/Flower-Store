import { OrdersNavEntry as OrdersNavEntry_31b2d4867dede6b8dd06dc274cd3a4ef } from '@/components/admin/OrdersNavEntry'
import { OrdersView as OrdersView_a28d6929ef93ef5c7f91db64a8fef64d } from '@/components/admin/OrdersView'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/components/admin/OrdersNavEntry#OrdersNavEntry": OrdersNavEntry_31b2d4867dede6b8dd06dc274cd3a4ef,
  "@/components/admin/OrdersView#OrdersView": OrdersView_a28d6929ef93ef5c7f91db64a8fef64d,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24
}
