import crypto from 'crypto';

/**
 * Razorpay Server-Side Client
 * Handles communication with Razorpay REST API using native fetch with Basic Authentication.
 * Never exposes RAZORPAY_KEY_SECRET to the client.
 */

export interface CreateRazorpayOrderOptions {
  amount: number; // in paise (integer)
  currency: string; // 'INR'
  receipt: string; // internal orderId
  notes?: Record<string, string>;
  idempotencyKey?: string;
  mockFailure?: boolean; // For automated gateway failure recovery testing
}

export interface RazorpayOrderResponse {
  id: string; // e.g. "order_EKwxwAgItmmXdp"
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string; // "created"
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

export interface RazorpayPaymentDetails {
  id: string; // e.g. "pay_29QQoUBi66xm2f"
  entity: string;
  amount: number; // in paise
  currency: string; // "INR"
  status: string; // "captured", "authorized", "failed", etc.
  order_id: string;
  method?: string;
  captured?: boolean;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  created_at?: number;
}

export function getRazorpayPublicConfig(): { keyId: string | undefined; isConfigured: boolean } {
  const keyId = process.env.RAZORPAY_KEY_ID?.replace(/^["']|["']$/g, '').trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^["']|["']$/g, '').trim();
  return {
    keyId,
    isConfigured: Boolean(keyId && keySecret),
  };
}

/**
 * Creates an order on Razorpay servers.
 * Always sends amount in integer paise and currency in INR.
 * Communicates directly with https://api.razorpay.com/v1/orders.
 * Throws a clear error if credentials are not configured.
 */
export async function createRazorpayOrder(options: CreateRazorpayOrderOptions): Promise<RazorpayOrderResponse> {
  const keyId = process.env.RAZORPAY_KEY_ID?.replace(/^["']|["']$/g, '').trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^["']|["']$/g, '').trim();

  if (options.mockFailure) {
    throw new Error('Simulated Razorpay API Gateway Timeout / Error (502)');
  }

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing. Please configure them in .env before creating payment orders.'
    );
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  };

  if (options.idempotencyKey) {
    headers['X-Razorpay-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt,
      notes: options.notes,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { description: errorBody };
    }
    throw new Error(parsed?.error?.description || `Razorpay order creation failed with status ${response.status}`);
  }

  return (await response.json()) as RazorpayOrderResponse;
}

/**
 * Verifies Razorpay payment signature for standard Checkout redirect/modal.
 * Computes HMAC SHA256 of `${razorpayOrderId}|${razorpayPaymentId}` with RAZORPAY_KEY_SECRET.
 * Uses constant-time buffer comparison to prevent timing attacks.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^["']|["']$/g, '').trim();
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
  const receivedBuffer = Buffer.from(razorpaySignature, 'utf-8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Verifies Razorpay Webhook signature against raw request body bytes.
 * Computes HMAC SHA256 of rawBody with RAZORPAY_WEBHOOK_SECRET.
 * Strictly never uses RAZORPAY_KEY_SECRET.
 * Uses constant-time buffer comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
}): boolean {
  const { rawBody, signature } = params;
  if (!rawBody || !signature) {
    return false;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.replace(/^["']|["']$/g, '').trim();
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
  const receivedBuffer = Buffer.from(signature, 'utf-8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Fetches authoritative payment details directly from Razorpay.
 * Used to verify payment capture status, amount, and currency server-side.
 */
export async function fetchRazorpayPayment(
  paymentId: string,
  options?: { mockPayment?: RazorpayPaymentDetails }
): Promise<RazorpayPaymentDetails> {
  if (options?.mockPayment) {
    return options.mockPayment;
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.replace(/^["']|["']$/g, '').trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^["']|["']$/g, '').trim();

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing.'
    );
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { description: errorBody };
    }
    throw new Error(parsed?.error?.description || `Failed to fetch payment details from Razorpay (status ${response.status})`);
  }

  return (await response.json()) as RazorpayPaymentDetails;
}
