import type { Metadata } from 'next';
import config from '@payload-config';
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views';
import { importMap } from '../importMap';

type PageParams = {
  segments?: string[];
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

type Args = {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> => {
  return generatePageMetadata({
    config,
    params: params as any,
    searchParams: searchParams as any,
  });
};

const NotFound = ({ params, searchParams }: Args) => {
  return (
    <NotFoundPage
      config={config}
      importMap={importMap}
      params={params as any}
      searchParams={searchParams as any}
    />
  );
};

export default NotFound;
