'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem } from '@/types';
import {
  BLOOM10_FLAT_DISCOUNT,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  formatINR,
} from '@/lib/currency';

interface CouponResult {
  success: boolean;
  message: string;
}

interface AppliedCouponInfo {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  freeShipping: boolean;
}

interface CartContextType {
  cart: CartItem[];
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'cartItemId'> & { cartItemId?: number }) => void;
  removeFromCart: (cartItemId: number) => void;
  updateQuantity: (cartItemId: number, newQty: number) => void;
  clearCart: () => void;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  totalItemCount: number;
  couponCode: string;
  applyCoupon: (code: string) => Promise<CouponResult>;
  couponError: string;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<AppliedCouponInfo | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [shippingFee, setShippingFee] = useState<number>(STANDARD_SHIPPING_FEE);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('floralux_cart');
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading cart:', e);
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('floralux_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }, [cart]);

  const addToCart = (item: Omit<CartItem, 'cartItemId'> & { cartItemId?: number }) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (i) =>
          i.id === item.id &&
          i.selectedSize?.name === item.selectedSize?.name &&
          i.selectedVase?.id === item.selectedVase?.id &&
          i.cardMessage === item.cardMessage
      );

      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += item.quantity || 1;
        return copy;
      }
      return [
        ...prev,
        {
          ...item,
          quantity: item.quantity || 1,
          cartItemId: item.cartItemId || Date.now() + Math.random(),
        },
      ];
    });
    setIsDrawerOpen(true);
  };

  const removeFromCart = (cartItemId: number) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: newQty } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCouponCode('');
    setCouponError('');
    setAppliedCouponInfo(null);
  };

  const applyCoupon = async (code: string): Promise<CouponResult> => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setCouponError('Please enter a coupon code.');
      return { success: false, message: 'Coupon code required' };
    }

    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          items: cart,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Invalid or expired promo code.';
        setCouponError(errorMsg);
        setCouponCode('');
        setDiscount(0);
        setAppliedCouponInfo(null);
        return { success: false, message: errorMsg };
      }

      setCouponCode(data.code);
      setCouponError('');
      setAppliedCouponInfo({
        code: data.code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minSpend: data.minSpend ?? 0,
        maxDiscount: data.maxDiscount ?? null,
        freeShipping: Boolean(data.freeShipping),
      });

      if (data.discountType === 'percentage') {
        setDiscount(data.discountValue / 100);
      } else if (data.discountType === 'fixed_amount') {
        setDiscount(data.discountValue);
      } else {
        setDiscount(0);
      }

      const successMsg = data.description || `${data.code} applied successfully!`;
      return { success: true, message: successMsg };
    } catch (e: any) {
      const errorMsg = 'Failed to validate promo code. Please try again.';
      setCouponError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  const subtotal = cart.reduce((acc, item) => {
    const base = item.selectedSize?.price || item.price;
    const vase = item.selectedVase?.price || 0;
    const addons = (item.addons || []).reduce((a, b) => a + b.price, 0);
    return acc + (base + vase + addons) * item.quantity;
  }, 0);

  let discountAmount = 0;
  if (appliedCouponInfo) {
    if (appliedCouponInfo.minSpend > 0 && subtotal < appliedCouponInfo.minSpend) {
      discountAmount = 0;
    } else if (appliedCouponInfo.discountType === 'percentage') {
      const raw = Math.round(subtotal * (appliedCouponInfo.discountValue / 100) * 100) / 100;
      discountAmount = appliedCouponInfo.maxDiscount ? Math.min(raw, appliedCouponInfo.maxDiscount) : raw;
    } else if (appliedCouponInfo.discountType === 'fixed_amount') {
      discountAmount = Math.min(appliedCouponInfo.discountValue, subtotal);
    }
  } else if (discount > 0) {
    discountAmount = discount > 1 ? Math.min(discount, subtotal) : Math.round(subtotal * discount * 100) / 100;
  }

  const isFreeShippingCoupon = appliedCouponInfo?.freeShipping;
  const currentShipping = (subtotal > FREE_SHIPPING_THRESHOLD || isFreeShippingCoupon) ? 0 : shippingFee;
  const total = Math.max(0, subtotal - discountAmount + currentShipping);
  const totalItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isDrawerOpen,
        setIsDrawerOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        discountAmount,
        shippingFee: currentShipping,
        total,
        totalItemCount,
        couponCode,
        applyCoupon,
        couponError,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
