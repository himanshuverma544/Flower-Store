import type { Metadata } from 'next';
import config from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
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

const Page = ({ params, searchParams }: Args) => {
  return (
    <RootPage
      config={config}
      importMap={importMap}
      params={params as any}
      searchParams={searchParams as any}
    />
  );
};

export default Page;
