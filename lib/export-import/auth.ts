/**
 * Flora Flowers — Export / Import Admin Authentication Guard
 *
 * Verifies that the incoming request is authenticated with an active
 * Payload CMS admin session having the 'admin' role.
 */

import { executeAuthStrategies, getPayload } from 'payload';
import configPromise from '@payload-config';
import { headers as getHeaders } from 'next/headers';

export async function authenticateAdmin() {
  try {
    const config = await configPromise;
    const payload = await getPayload({ config });
    const headers = await getHeaders();

    const authRes = await executeAuthStrategies({
      headers,
      payload,
    });

    const user = authRes?.user;

    if (!user) {
      return {
        authorized: false as const,
        error: 'Authentication required. Please log into Payload Admin as an administrator.',
        status: 401,
      };
    }

    if (user.role !== 'admin') {
      return {
        authorized: false as const,
        error: 'Access denied: Catalog Export & Import requires an administrator account.',
        status: 403,
      };
    }

    return {
      authorized: true as const,
      user,
    };
  } catch (err: any) {
    console.error('[Export/Import Auth Error]:', err);
    return {
      authorized: false as const,
      error: 'Internal server error during authorization verification.',
      status: 500,
    };
  }
}
