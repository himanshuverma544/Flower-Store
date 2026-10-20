import type { Access, PayloadRequest } from 'payload';

/**
 * Access check: Only users with the 'admin' role.
 */
export const isAdmin: Access = ({ req: { user } }) => {
  return Boolean(user && user.role === 'admin');
};

/**
 * Access check: Users with either 'admin' or 'shop-manager' role.
 */
export const isStaff: Access = ({ req: { user } }) => {
  return Boolean(user && (user.role === 'admin' || user.role === 'shop-manager'));
};

/**
 * Boolean access check for admin panel accessibility.
 */
export const canAccessAdmin = ({ req: { user } }: { req: PayloadRequest }): boolean => {
  return Boolean(user && (user.role === 'admin' || user.role === 'shop-manager'));
};

/**
 * Access check: Public can read published items; staff can read all items.
 */
export const publicReadStaffWrite = {
  read: (): boolean => true,
  create: isStaff,
  update: isStaff,
  delete: isStaff,
};

/**
 * Access check: Staff only (for internal catalog settings and coupons).
 */
export const staffOnly = {
  read: isStaff,
  create: isStaff,
  update: isStaff,
  delete: isStaff,
};

/**
 * Access check: Admin only (for system settings and user management).
 */
export const adminOnly = {
  read: isStaff,
  create: isAdmin,
  update: isAdmin,
  delete: isAdmin,
};
