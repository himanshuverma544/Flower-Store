/**
 * Flora Flowers — Export / Import Package Validator
 *
 * Validates uploaded JSON packages against schema, version, size, and business rules.
 * Rejects malformed structures, internal duplicate keys, and invalid types.
 */

import { EXPORT_FORMAT_VERSION, ExportPackage } from './types';

export const MAX_IMPORT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit
export const MAX_IMPORT_RECORDS = 5000;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  packageData?: ExportPackage;
}

export function validatePackageJson(rawJson: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawJson || typeof rawJson !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid import file: Root content must be a JSON object.'],
      warnings: [],
    };
  }

  const pkg = rawJson as Partial<ExportPackage>;

  // 1. Validate Manifest
  if (!pkg.manifest || typeof pkg.manifest !== 'object') {
    errors.push('Missing "manifest" metadata block in export package.');
    return { isValid: false, errors, warnings };
  }

  const manifest = pkg.manifest;

  if (manifest.format !== EXPORT_FORMAT_VERSION) {
    errors.push(
      `Unsupported export format "${manifest.format || 'unknown'}". Expected "${EXPORT_FORMAT_VERSION}".`
    );
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Manifest version is missing or invalid.');
  }

  if (!manifest.timestamp || isNaN(Date.parse(manifest.timestamp))) {
    warnings.push('Manifest timestamp is missing or not a valid ISO date.');
  }

  // 2. Validate Data container
  if (!pkg.data || typeof pkg.data !== 'object') {
    errors.push('Missing "data" collection payload in export package.');
    return { isValid: false, errors, warnings };
  }

  const data = pkg.data;

  // 3. Media validation
  if (data.media) {
    if (!Array.isArray(data.media)) {
      errors.push('Collection "data.media" must be an array.');
    } else {
      const filenames = new Set<string>();
      data.media.forEach((m, idx) => {
        if (!m.filename || typeof m.filename !== 'string') {
          errors.push(`Media record at index ${idx} is missing a valid "filename".`);
        } else if (filenames.has(m.filename)) {
          errors.push(`Duplicate media filename "${m.filename}" detected in package.`);
        } else {
          filenames.add(m.filename);
        }
      });
    }
  }

  // 4. Categories validation
  if (data.categories) {
    if (!Array.isArray(data.categories)) {
      errors.push('Collection "data.categories" must be an array.');
    } else {
      const slugs = new Set<string>();
      data.categories.forEach((c, idx) => {
        if (!c.name || typeof c.name !== 'string') {
          errors.push(`Category at index ${idx} is missing a required "name".`);
        }
        if (!c.slug || typeof c.slug !== 'string') {
          errors.push(`Category "${c.name || idx}" is missing a required "slug".`);
        } else if (slugs.has(c.slug)) {
          errors.push(`Duplicate category slug "${c.slug}" detected in package.`);
        } else {
          slugs.add(c.slug);
        }
      });
    }
  }

  // 5. Addons validation
  if (data.addons) {
    if (!Array.isArray(data.addons)) {
      errors.push('Collection "data.addons" must be an array.');
    } else {
      const slugs = new Set<string>();
      data.addons.forEach((a, idx) => {
        if (!a.name || typeof a.name !== 'string') {
          errors.push(`Add-on at index ${idx} is missing a required "name".`);
        }
        if (!a.slug || typeof a.slug !== 'string') {
          errors.push(`Add-on "${a.name || idx}" is missing a required "slug".`);
        } else if (slugs.has(a.slug)) {
          errors.push(`Duplicate add-on slug "${a.slug}" detected in package.`);
        } else {
          slugs.add(a.slug);
        }
        if (typeof a.price !== 'number' || a.price < 0) {
          errors.push(`Add-on "${a.name || idx}" price must be a non-negative number.`);
        }
      });
    }
  }

  // 6. Coupons validation
  if (data.coupons) {
    if (!Array.isArray(data.coupons)) {
      errors.push('Collection "data.coupons" must be an array.');
    } else {
      const codes = new Set<string>();
      data.coupons.forEach((c, idx) => {
        if (!c.code || typeof c.code !== 'string') {
          errors.push(`Coupon at index ${idx} is missing a required "code".`);
        } else {
          const upper = c.code.toUpperCase().trim();
          if (codes.has(upper)) {
            errors.push(`Duplicate coupon code "${upper}" detected in package.`);
          } else {
            codes.add(upper);
          }
        }
        if (typeof c.discountValue !== 'number' || c.discountValue < 0) {
          errors.push(`Coupon "${c.code || idx}" discount value must be a non-negative number.`);
        }
      });
    }
  }

  // 7. Orders validation
  if (data.orders) {
    if (!Array.isArray(data.orders)) {
      errors.push('Collection "data.orders" must be an array.');
    } else {
      const orderIds = new Set<string>();
      data.orders.forEach((o, idx) => {
        if (!o.orderId || typeof o.orderId !== 'string') {
          errors.push(`Order at index ${idx} is missing a required "orderId".`);
        } else {
          const upper = o.orderId.trim();
          if (orderIds.has(upper)) {
            errors.push(`Duplicate orderId "${upper}" detected in package.`);
          } else {
            orderIds.add(upper);
          }
        }
        if (typeof o.total !== 'number' || o.total < 0) {
          errors.push(`Order "${o.orderId || idx}" total must be a non-negative number.`);
        }
      });
    }
  }

  // 8. Products validation
  if (data.products) {
    if (!Array.isArray(data.products)) {
      errors.push('Collection "data.products" must be an array.');
    } else {
      const slugs = new Set<string>();
      data.products.forEach((p, idx) => {
        if (!p.name || typeof p.name !== 'string') {
          errors.push(`Product at index ${idx} is missing a required "name".`);
        }
        if (!p.slug || typeof p.slug !== 'string') {
          errors.push(`Product "${p.name || idx}" is missing a required "slug".`);
        } else if (slugs.has(p.slug)) {
          errors.push(`Duplicate product slug "${p.slug}" detected in package.`);
        } else {
          slugs.add(p.slug);
        }

        if (typeof p.price !== 'number' || p.price < 0) {
          errors.push(`Product "${p.name || idx}" price must be a non-negative number.`);
        }

        if (!p.categorySlug) {
          errors.push(`Product "${p.name || idx}" is missing its required "categorySlug" relationship.`);
        }

        // Validate sizes array
        if (p.sizes && Array.isArray(p.sizes)) {
          for (const s of p.sizes) {
            if (!s.name || typeof s.name !== 'string') {
              errors.push(`Product "${p.slug}" size option is missing a name.`);
            }
            if (typeof s.price !== 'number' || s.price < 0) {
              errors.push(`Product "${p.slug}" size "${s.name || 'unnamed'}" has invalid price.`);
            }
          }
        }
      });
    }
  }

  // Total record limit check
  const totalRecords =
    (data.media?.length || 0) +
    (data.categories?.length || 0) +
    (data.addons?.length || 0) +
    (data.coupons?.length || 0) +
    (data.products?.length || 0) +
    (data.siteSettings ? 1 : 0);

  if (totalRecords > MAX_IMPORT_RECORDS) {
    errors.push(
      `Package contains ${totalRecords} records, exceeding the maximum safe limit of ${MAX_IMPORT_RECORDS} records.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    packageData: errors.length === 0 ? (pkg as ExportPackage) : undefined,
  };
}
