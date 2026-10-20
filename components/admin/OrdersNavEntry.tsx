'use client';

import React from 'react';
import { NavGroup, Link } from '@payloadcms/ui';
import { usePathname } from 'next/navigation';

export const OrdersNavEntry: React.FC = () => {
  const pathname = usePathname();
  const href = '/admin/orders';
  const isActive = pathname.startsWith(href);

  return (
    <NavGroup label="Commerce">
      {pathname === href ? (
        <div className="nav__link active" id="nav-orders">
          <div className="nav__link-indicator" />
          <span className="nav__link-label">Orders &amp; Fulfillment</span>
        </div>
      ) : (
        <Link
          className={`nav__link ${isActive ? 'active' : ''}`}
          href={href}
          id="nav-orders"
          prefetch={false}
        >
          {isActive && <div className="nav__link-indicator" />}
          <span className="nav__link-label">Orders &amp; Fulfillment</span>
        </Link>
      )}
    </NavGroup>
  );
};

