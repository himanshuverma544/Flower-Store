'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ArrowRight, Tag, Gift, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatINR, FREE_SHIPPING_THRESHOLD } from '@/lib/currency';

export default function CartDrawer() {
  const {
    cart,
    isDrawerOpen,
    setIsDrawerOpen,
    removeFromCart,
    updateQuantity,
    subtotal,
    discountAmount,
    shippingFee,
    total,
    applyCoupon,
    couponCode,
    couponError,
  } = useCart();

  const [inputCode, setInputCode] = useState<string>('');

  if (!isDrawerOpen) return null;

  const handleApplyCoupon = (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode) return;
    applyCoupon(inputCode);
  };

  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
            <div>
              <h2 className="font-serif text-xl font-semibold text-stone-900">Your Floral Bag</h2>
              <p className="text-xs text-stone-500">
                {cart.length} {cart.length === 1 ? 'arrangement' : 'arrangements'} selected
              </p>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="bg-rose-50/80 px-5 py-3 border-b border-rose-100">
            <div className="flex items-center justify-between text-xs font-medium text-rose-950 mb-1.5">
              <span>
                {remainingForFreeShipping > 0
                  ? `Add ${formatINR(remainingForFreeShipping)} more for FREE Delivery`
                  : '🎉 You have unlocked Free White-Glove Delivery!'}
              </span>
              <span className="font-bold">{Math.round(freeShippingProgress)}%</span>
            </div>
            <div className="w-full bg-rose-200/80 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-medium text-stone-800">Your bag is empty</h3>
                <p className="text-stone-500 text-xs mt-1 max-w-xs mx-auto">
                  Browse our fresh flower collection and send handcrafted beauty today.
                </p>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="mt-6 px-6 py-2.5 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 transition-colors"
                >
                  Explore Bouquets
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/40 flex gap-4 transition-all"
                >
                  <div className="relative w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-stone-200">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif text-sm font-semibold text-stone-900 line-clamp-1">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-stone-400 hover:text-rose-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-[11px] text-stone-500 mt-0.5 space-y-0.5">
                        {item.selectedSize && <div>Size: {item.selectedSize.name}</div>}
                        {item.selectedVase && <div>Vase: {item.selectedVase.name}</div>}
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-rose-800 font-medium">
                            + {item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}
                        {item.deliveryDate && (
                          <div className="text-emerald-700 font-medium">
                            📅 Delivery: {item.deliveryDate} ({item.deliverySlot || 'Anytime'})
                          </div>
                        )}
                        {item.cardMessage && (
                          <div className="italic text-stone-600 line-clamp-1 border-l-2 border-rose-300 pl-1.5 mt-1">
                            Card: "{item.cardMessage}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200/60">
                      <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white">
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="p-1 hover:bg-stone-100 text-stone-600"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-semibold text-stone-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="p-1 hover:bg-stone-100 text-stone-600"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-sm font-bold text-stone-900 font-serif">
                        {formatINR(
                          ((item.selectedSize?.price || item.price) +
                            (item.selectedVase?.price || 0) +
                            (item.addons || []).reduce((a, b) => a + b.price, 0)) *
                          item.quantity
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Summary */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-stone-200 bg-white space-y-3">
              {/* Promo Code Input */}
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Promo code (e.g. SPRING20)"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-stone-300 rounded-lg uppercase tracking-wider font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-800 text-white text-xs font-semibold rounded-lg hover:bg-stone-900 transition-colors"
                >
                  Apply
                </button>
              </form>

              {couponCode && (
                <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Coupon <strong className="font-bold">{couponCode}</strong> applied
                  </span>
                  <span>-{formatINR(discountAmount)}</span>
                </div>
              )}
              {couponError && <p className="text-xs text-rose-600">{couponError}</p>}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-100">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-800">{formatINR(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery ({subtotal > FREE_SHIPPING_THRESHOLD ? 'Free Shipping' : 'Standard Courier'})</span>
                  <span className="font-semibold text-stone-800">
                    {shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-200">
                  <span className="font-serif">Estimated Total</span>
                  <span className="font-serif text-base">{formatINR(total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href="/checkout"
                onClick={() => setIsDrawerOpen(false)}
                className="w-full py-3.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
