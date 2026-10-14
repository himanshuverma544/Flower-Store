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
  applyCoupon: (code: string) => CouponResult;
  couponError: string;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
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
  };

  const applyCoupon = (code: string): CouponResult => {
    const clean = code.trim().toUpperCase();
    if (clean === 'SPRING20') {
      setDiscount(0.2);
      setCouponError('');
      setCouponCode('SPRING20');
      return { success: true, message: 'Spring Bloom 20% discount applied!' };
    } else if (clean === 'FREEDELIVERY') {
      setShippingFee(0);
      setCouponError('');
      setCouponCode('FREEDELIVERY');
      return { success: true, message: 'Free Express Delivery applied!' };
    } else if (clean === 'BLOOM10') {
      setDiscount(BLOOM10_FLAT_DISCOUNT);
      setCouponError('');
      setCouponCode('BLOOM10');
      return {
        success: true,
        message: `${formatINR(BLOOM10_FLAT_DISCOUNT)} off applied to your bouquet!`,
      };
    } else {
      setCouponError('Invalid promo code. Try "SPRING20" or "FREEDELIVERY"');
      return { success: false, message: 'Invalid coupon' };
    }
  };

  const subtotal = cart.reduce((acc, item) => {
    const base = item.selectedSize?.price || item.price;
    const vase = item.selectedVase?.price || 0;
    const addons = (item.addons || []).reduce((a, b) => a + b.price, 0);
    return acc + (base + vase + addons) * item.quantity;
  }, 0);

  const discountAmount =
    discount > 1 ? discount : Math.round(subtotal * discount * 100) / 100;

  const currentShipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : shippingFee;
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
