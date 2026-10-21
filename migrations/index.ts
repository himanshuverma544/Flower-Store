import * as migration_20261015_092621_init from './20261015_092621_init';
import * as migration_20261015_094742_add_floralux_collections from './20261015_094742_add_floralux_collections';
import * as migration_20261015_095851_remove_vases_consolidate_addons from './20261015_095851_remove_vases_consolidate_addons';
import * as migration_20261016_111500_add_media_cloud_storage_fields from './20261016_111500_add_media_cloud_storage_fields';
import * as migration_20261021_111958_add_orders_collection from './20261021_111958_add_orders_collection';

export const migrations = [
  {
    up: migration_20261015_092621_init.up,
    down: migration_20261015_092621_init.down,
    name: '20261015_092621_init',
  },
  {
    up: migration_20261015_094742_add_floralux_collections.up,
    down: migration_20261015_094742_add_floralux_collections.down,
    name: '20261015_094742_add_floralux_collections',
  },
  {
    up: migration_20261015_095851_remove_vases_consolidate_addons.up,
    down: migration_20261015_095851_remove_vases_consolidate_addons.down,
    name: '20261015_095851_remove_vases_consolidate_addons',
  },
  {
    up: migration_20261016_111500_add_media_cloud_storage_fields.up,
    down: migration_20261016_111500_add_media_cloud_storage_fields.down,
    name: '20261016_111500_add_media_cloud_storage_fields',
  },
  {
    up: migration_20261021_111958_add_orders_collection.up,
    down: migration_20261021_111958_add_orders_collection.down,
    name: '20261021_111958_add_orders_collection'
  },
];
