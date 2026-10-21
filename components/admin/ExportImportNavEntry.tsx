'use client';

import React from 'react';
import { NavGroup, Link } from '@payloadcms/ui';
import { usePathname } from 'next/navigation';

export const ExportImportNavEntry: React.FC = () => {
  const pathname = usePathname();
  const href = '/admin/export-import';
  const isActive = pathname.startsWith(href);

  return (
    <NavGroup label="Tools">
      {pathname === href ? (
        <div className="nav__link active" id="nav-export-import">
          <div className="nav__link-indicator" />
          <span className="nav__link-label">Export / Import</span>
        </div>
      ) : (
        <Link
          className={`nav__link ${isActive ? 'active' : ''}`}
          href={href}
          id="nav-export-import"
          prefetch={false}
        >
          {isActive && <div className="nav__link-indicator" />}
          <span className="nav__link-label">Export / Import</span>
        </Link>
      )}
    </NavGroup>
  );
};
