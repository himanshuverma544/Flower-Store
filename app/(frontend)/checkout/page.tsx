'use client';

import React, { useState, useEffect, useRef, FormEvent, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Gift,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  Building2,
  Wallet,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCart } from '@/context/CartContext';
import { formatINR } from '@/lib/currency';
import { RecipientInfo, SenderInfo, Order } from '@/types';
import {
  RazorpayOptions,
  RazorpaySuccessResponse,
} from '@/types/razorpay';

/**
 * Loads the external Razorpay Checkout SDK dynamically.
 * Resolves true once window.Razorpay is available.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.getElementById('razorpay-checkout-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface PaymentAlertState {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export default function CheckoutPage() {
  const {
    cart,
    subtotal,
    discountAmount,
    shippingFee,
    total,
    couponCode,
    clearCart,
  } = useCart();

  // Step state (1: Details & Payment, 3: Confirmation)
  const [step, setStep] = useState<number>(1);

  // Form State
  const [recipient, setRecipient] = useState<RecipientInfo>({
    fullName: 'Sophia Martinez',
    phone: '(555) 382-9102',
    address: '742 Evergreen Blossom Way',
    apt: 'Apt 4B',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    notes: 'Please ring bell, or leave safely in the shaded alcove.',
  });

  const [sender, setSender] = useState<SenderInfo>({
    senderName: 'Alex Morgan',
    senderEmail: 'alex.morgan@example.com',
    senderPhone: '(555) 123-4567',
    keepSecret: true,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [paymentAlert, setPaymentAlert] = useState<PaymentAlertState | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Preload Razorpay Checkout SDK on page mount
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Maintain client idempotency key per cart/coupon revision
  // Regenerates only if the cart contents or coupon changes
  const cartSignature = useMemo(() => {
    return `${cart
      .map(
        (c) =>
          `${c.cartItemId}:${c.quantity}:${c.selectedSize?.name || ''}:${c.selectedVase?.id || ''}`
      )
      .join('|')}_${couponCode || ''}`;
  }, [cart, couponCode]);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `flx_chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  const lastSignatureRef = useRef(cartSignature);

  useEffect(() => {
    if (lastSignatureRef.current !== cartSignature) {
      lastSignatureRef.current = cartSignature;
      setIdempotencyKey(`flx_chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    }
  }, [cartSignature]);

  // Empty cart fallback
  if (cart.length === 0 && !placedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <Gift className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-stone-900">Your bag is empty</h2>
        <p className="text-stone-500 text-sm mt-1">
          Select an artisanal bouquet before proceeding to checkout.
        </p>
        <Link
          href="/flowers"
          className="mt-6 inline-block px-6 py-3 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl"
        >
          Browse Flowers
        </Link>
      </div>
    );
  }

  /**
   * Handles payment success callback from the Razorpay modal.
   * Strictly initiates server-side cryptographic signature & payment verification.
   * Displays payment success only AFTER the backend confirms verified, accepted status.
   * Preserves cart and shows error banner if verification fails.
   */
  const handlePaymentSuccess = async (
    orderData: {
      orderId: string;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
      trackingToken?: string;
      subtotal?: number;
      discountAmount?: number;
      shippingFee?: number;
      total?: number;
      status: string;
    },
    response: RazorpaySuccessResponse
  ) => {
    setIsProcessing(true);
    setIsVerifying(true);
    setPaymentAlert(null);

    try {
      // Initiate authoritative server-side signature and capture verification
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          razorpayOrderId: orderData.razorpayOrderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          trackingToken: orderData.trackingToken,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(
          verifyData.message ||
            verifyData.error ||
            'Payment verification failed on the server. If money was debited, it will be automatically reconciled.'
        );
      }

      // Verification confirmed by server!
      const estimatedDelivery = cart[0]?.deliveryDate || 'Tomorrow';
      const slot = cart[0]?.deliverySlot || 'Morning (9 AM - 1 PM)';

      const newOrder: Order = {
        id: orderData.orderId,
        trackingToken: orderData.trackingToken,
        razorpayOrderId: orderData.razorpayOrderId,
        razorpayPaymentId: response.razorpay_payment_id,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        items: [...cart],
        subtotal: orderData.subtotal ?? subtotal,
        discountAmount: orderData.discountAmount ?? discountAmount,
        shippingFee: orderData.shippingFee ?? shippingFee,
        total: orderData.total ?? total,
        recipient,
        sender,
        cardMessage: cart[0]?.cardMessage,
        status: orderData.status || 'Payment Pending',
        currentStep: 1,
        estimatedDelivery,
        slot,
      };

      if (verifyData.status) {
        newOrder.status = verifyData.status;
      }

      // Cache locally for instant track-order access with tracking token
      try {
        const existing = JSON.parse(localStorage.getItem('floralux_orders') || '[]');
        localStorage.setItem('floralux_orders', JSON.stringify([newOrder, ...existing]));
      } catch (err) {
        console.error('Error caching order locally:', err);
      }

      setPlacedOrder(newOrder);
      clearCart();
      setIsProcessing(false);
      setIsVerifying(false);
      setStep(3);

      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#e11d48', '#fda4af', '#fb7185', '#15803d', '#f59e0b'],
        });
      } catch (e) {
        // ignore
      }
    } catch (verifyErr: any) {
      console.error('Server payment verification error:', verifyErr);
      setIsProcessing(false);
      setIsVerifying(false);
      setPaymentAlert({
        type: 'error',
        title: 'Payment Verification Error',
        message:
          verifyErr.message ||
          'Server payment verification could not be completed. Your cart has been safely preserved.',
      });
    }
  };

  /**
   * Primary checkout handler.
   * Calls server-authoritative /api/payments/create-order and launches Razorpay modal.
   */
  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setPaymentAlert(null);
    setIsProcessing(true);

    try {
      // 1. Ensure Razorpay Checkout SDK is loaded
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        setIsProcessing(false);
        setPaymentAlert({
          type: 'error',
          title: 'Gateway Unavailable',
          message: 'Payment gateway SDK failed to load. Please check your internet connection.',
        });
        return;
      }

      const estimatedDelivery = cart[0]?.deliveryDate || 'Tomorrow';
      const slot = cart[0]?.deliverySlot || 'Morning (9 AM - 1 PM)';
      const cardMessage = cart[0]?.cardMessage || undefined;

      // 2. Authoritative server-side payment order creation
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          couponCode: couponCode || undefined,
          recipient,
          sender,
          cardMessage,
          deliveryDate: estimatedDelivery,
          deliverySlot: slot,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsProcessing(false);
        const errorDetail = data.error || data.message || 'Payment gateway communication failed.';
        setPaymentAlert({
          type: 'error',
          title: 'Payment Gateway Error',
          message: `${data.message || 'Unable to initialize order'}${data.error && data.error !== data.message ? ` (${data.error})` : ''}.`,
        });
        return;
      }

      // 3. Initialize Razorpay modal using server-provided details
      const options: RazorpayOptions = {
        key: data.keyId,
        amount: data.amount, // Authoritative integer amount in paise from server
        currency: data.currency || 'INR',
        name: 'FloraLux Floral Studio',
        description: `Bouquet Order #${data.orderId}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: sender.senderName,
          email: sender.senderEmail,
          contact: sender.senderPhone,
        },
        notes: {
          orderId: data.orderId,
        },
        theme: {
          color: '#be123c', // Rose-700
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setPaymentAlert({
              type: 'warning',
              title: 'Payment Window Closed',
              message:
                'Payment was not completed. Your floral bouquet and order details remain safely saved in your cart. You can reopen checkout at any time.',
            });
          },
        },
        handler: (response: RazorpaySuccessResponse) => {
          handlePaymentSuccess(data, response);
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', (failResponse: any) => {
        setIsProcessing(false);
        const reason =
          failResponse?.error?.description ||
          failResponse?.error?.reason ||
          'Payment transaction was declined or interrupted by the gateway.';
        setPaymentAlert({
          type: 'error',
          title: 'Payment Failed',
          message: `${reason} Your cart items and discounts are intact. Please try another card or UPI option.`,
        });
      });

      rzpInstance.open();
    } catch (err: any) {
      console.error('Order placement failed:', err);
      setIsProcessing(false);
      setPaymentAlert({
        type: 'error',
        title: 'Checkout Error',
        message: err.message || 'Something went wrong initiating your payment. Please try again.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-xs uppercase font-bold tracking-widest text-rose-700 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-rose-600" />
          Encrypted 256-Bit SSL Checkout • Razorpay Test Mode
        </span>
        <h1 className="text-3xl font-serif font-bold text-stone-900 mt-1">
          {step === 3 ? 'Order Registered!' : 'Complete Your Floral Gift'}
        </h1>
      </div>

      {step === 3 && placedOrder ? (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Payment Authorized • Verification Pending
            </div>
            <h2 className="font-serif text-3xl font-bold text-stone-900 mt-1">
              Thank You, {placedOrder.sender.senderName}!
            </h2>
            <p className="text-stone-600 text-sm mt-1">
              Your order has been recorded and an email receipt has been sent to{' '}
              <strong>{placedOrder.sender.senderEmail}</strong>
            </p>
          </div>

          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-stone-200/60 pb-2">
              <span className="text-stone-500 font-medium">Tracking Order ID:</span>
              <span className="font-bold text-stone-900 font-mono text-sm">{placedOrder.id}</span>
            </div>
            {placedOrder.razorpayPaymentId && (
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium">Razorpay Payment ID:</span>
                <span className="font-mono text-stone-700 text-xs font-medium">
                  {placedOrder.razorpayPaymentId}
                </span>
              </div>
            )}
            {placedOrder.razorpayOrderId && (
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium">Razorpay Order ID:</span>
                <span className="font-mono text-stone-700 text-xs font-medium">
                  {placedOrder.razorpayOrderId}
                </span>
              </div>
            )}
            <div className="flex justify-between border-b border-stone-200/60 pb-2">
              <span className="text-stone-500 font-medium">Delivering To:</span>
              <span className="font-semibold text-stone-800">
                {placedOrder.recipient.fullName} ({placedOrder.recipient.address},{' '}
                {placedOrder.recipient.city})
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-200/60 pb-2">
              <span className="text-stone-500 font-medium">Delivery Slot:</span>
              <span className="font-semibold text-emerald-800">
                📅 {placedOrder.estimatedDelivery} • {placedOrder.slot}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-stone-500 font-medium">Total Authorized:</span>
              <span className="font-bold text-stone-900 font-serif text-sm">
                {formatINR(placedOrder.total)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/track-order?id=${placedOrder.id}${
                placedOrder.trackingToken
                  ? `&token=${encodeURIComponent(placedOrder.trackingToken)}`
                  : ''
              }`}
              className="px-6 py-3.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Truck className="w-4 h-4" />
              <span>Track Live Delivery Progress</span>
            </Link>
            <Link
              href="/"
              className="px-6 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-colors"
            >
              Return to Florist Homepage
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-8">
            <form onSubmit={handlePlaceOrder} className="space-y-8">
              {/* Recipient Details */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-stone-900">
                    Recipient Delivery Address
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Recipient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={recipient.fullName}
                      onChange={(e) => setRecipient({ ...recipient, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Recipient Phone (For Delivery Driver) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={recipient.phone}
                      onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipient.address}
                    onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Apt / Suite
                    </label>
                    <input
                      type="text"
                      value={recipient.apt}
                      onChange={(e) => setRecipient({ ...recipient, apt: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={recipient.city}
                      onChange={(e) => setRecipient({ ...recipient, city: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Zip Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={recipient.zip}
                      onChange={(e) => setRecipient({ ...recipient, zip: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Driver Delivery Notes / Gate Code
                  </label>
                  <input
                    type="text"
                    value={recipient.notes}
                    onChange={(e) => setRecipient({ ...recipient, notes: e.target.value })}
                    placeholder="e.g. Leave with doorman, Ring Apt 4B, surprise delivery"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Sender Details */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-stone-900">
                    Your Information (Sender & Receipt)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={sender.senderName}
                      onChange={(e) => setSender({ ...sender, senderName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Your Email (For Receipt & Tracking) *
                    </label>
                    <input
                      type="email"
                      required
                      value={sender.senderEmail}
                      onChange={(e) => setSender({ ...sender, senderEmail: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={sender.keepSecret}
                    onChange={(e) => setSender({ ...sender, keepSecret: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    Keep sender identity secret on delivery label (Surprise Gift Mode)
                  </span>
                </label>
              </div>

              {/* Payment Details */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                      3
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-stone-900">
                      Razorpay Secure Payment
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Test Mode Active
                  </div>
                </div>

                {/* Gateway Feature Badges */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/60 via-stone-50 to-stone-50 border border-rose-100/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-stone-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-rose-700" />
                      <span>Razorpay Trusted Gateway</span>
                    </div>
                    <span className="text-[11px] font-mono text-stone-500 font-medium">
                      INR Currency • 100% Secure
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    Upon clicking place order, the official Razorpay Checkout modal will open. You can
                    complete payment using cards, UPI, or test instruments without leaving the page.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-stone-200/80 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-[11px] font-medium text-stone-700">Cards</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-stone-200/80 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-medium text-stone-700">UPI / QR</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-stone-200/80 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px] font-medium text-stone-700">Netbanking</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-stone-200/80 flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[11px] font-medium text-stone-700">Wallets</span>
                    </div>
                  </div>
                </div>

                {/* Payment Alert / State Notification */}
                {paymentAlert && (
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                      paymentAlert.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : paymentAlert.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                  >
                    {paymentAlert.type === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <strong className="block font-semibold">{paymentAlert.title}</strong>
                      <p className="leading-relaxed">{paymentAlert.message}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full mt-4 py-4 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white font-semibold text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>{isVerifying ? 'Verifying Payment with Gateway...' : 'Opening Secure Razorpay Gateway...'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Proceed to Razorpay Checkout — {formatINR(total)}</span>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-stone-500">
                  Transactions are encrypted and authenticated directly with Razorpay.
                </p>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
              <h3 className="font-serif text-lg font-semibold text-stone-900 border-b border-stone-100 pb-3">
                Order Floral Summary ({cart.length})
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex gap-3 text-xs border-b border-stone-100 pb-3">
                    <div className="relative w-16 h-18 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-stone-900 line-clamp-1">{item.name}</div>
                      <div className="text-stone-500 mt-0.5">
                        {item.selectedSize?.name} • Qty {item.quantity}
                      </div>
                      {item.selectedVase && (
                        <div className="text-stone-500">Vase: {item.selectedVase.name}</div>
                      )}
                      {item.cardMessage && (
                        <div className="italic text-rose-800 bg-rose-50/50 p-1.5 rounded mt-1 border-l-2 border-rose-300">
                          Card: "{item.cardMessage}"
                        </div>
                      )}
                    </div>
                    <div className="font-serif font-bold text-stone-900">
                      {formatINR(
                        ((item.selectedSize?.price || item.price) +
                          (item.selectedVase?.price || 0) +
                          (item.addons || []).reduce((a, b) => a + b.price, 0)) *
                          item.quantity
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs text-stone-600 pt-2 border-t border-stone-100">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-800">{formatINR(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount ({couponCode})</span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Hand Delivery</span>
                  <span className="font-semibold text-stone-800">
                    {shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-serif font-bold text-stone-900 pt-3 border-t border-stone-200">
                  <span>Total Amount</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-stone-100/80 border border-stone-200/80 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-stone-600 leading-relaxed">
                <strong className="text-stone-900 block font-semibold mb-0.5">
                  FloraLux Freshness & Privacy Guarantee
                </strong>
                Every flower order is hand-inspected before dispatch. If stems do not thrive for 7
                days, we provide a full complimentary replacement without hassle.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
