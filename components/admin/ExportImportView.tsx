import React from 'react';
import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { ExportImportManager } from './ExportImportManager';

export const ExportImportView: React.FC<AdminViewServerProps> = (props) => {
  const init = props.initPageResult;
  const visibleEntities = init?.visibleEntities || (props as any).visibleEntities || {
    collections: props.payload?.config?.collections?.map((c) => c.slug) || [],
    globals: props.payload?.config?.globals?.map((g) => g.slug) || [],
  };

  return (
    <DefaultTemplate
      {...props}
      i18n={init?.req?.i18n || props.i18n}
      locale={init?.locale}
      params={props.params}
      payload={props.payload}
      permissions={init?.permissions!}
      req={init?.req}
      searchParams={props.searchParams}
      user={props.user}
      visibleEntities={{
        collections: visibleEntities?.collections,
        globals: visibleEntities?.globals,
      }}
    >
      <ExportImportManager user={props.user} />
    </DefaultTemplate>
  );
};
