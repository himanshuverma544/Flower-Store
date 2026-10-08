'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search, Truck, Sparkles, Menu, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function Navbar() {
  const { totalItemCount, setIsDrawerOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const pathname = usePathname();

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-rose-950 text-rose-100 text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-rose-900/50">
        <Sparkles className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
        <span>Fresh Farm Blooms Cut Sunrise Daily • Same-Day Hand Delivery Before 2 PM • Use Code <strong className="text-rose-300 underline underline-offset-2">SPRING20</strong> for 20% Off</span>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/70 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Left Nav (Desktop) */}
            <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-stone-700">
              <Link
                href="/flowers"
                className={`transition-colors hover:text-rose-600 ${pathname === '/flowers' ? 'text-rose-600 font-semibold' : ''}`}
              >
                All Flowers
              </Link>
              <Link
                href="/flowers?occasion=Romance"
                className="transition-colors hover:text-rose-600"
              >
                Romance & Roses
              </Link>
              <Link
                href="/flowers?category=birthday"
                className="transition-colors hover:text-rose-600"
              >
                Birthdays
              </Link>
              <Link
                href="/flowers?category=luxury"
                className="transition-colors hover:text-rose-600"
              >
                Grand Luxe
              </Link>
              <Link
                href="/track-order"
                className={`flex items-center gap-1.5 transition-colors hover:text-emerald-700 ${pathname === '/track-order' ? 'text-emerald-700 font-semibold' : ''}`}
              >
                <Truck className="w-4 h-4 text-emerald-600" />
                Track Order
              </Link>
            </nav>

            {/* Mobile menu trigger */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-stone-700 hover:text-rose-700 focus:outline-none"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Center Brand Identity */}
            <div className="flex-1 md:flex-initial text-center md:text-left">
              <Link href="/" className="inline-flex flex-col items-center group">
                <span className="font-serif text-2xl sm:text-3xl tracking-tight text-stone-900 group-hover:text-rose-800 transition-colors">
                  Flora<span className="text-rose-600 italic font-normal">Lux</span>
                </span>
                <span className="text-[10px] tracking-[0.28em] uppercase text-stone-400 font-sans -mt-1 font-semibold">
                  Artisanal Botanicals
                </span>
              </Link>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center space-x-3 sm:space-x-5">
              {/* Search input (desktop) */}
              <form
                action="/flowers"
                method="GET"
                className="hidden lg:flex items-center relative"
              >
                <input
                  type="text"
                  name="q"
                  placeholder="Search peonies, roses, lilies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 pl-9 pr-4 py-1.5 text-xs bg-stone-100/80 rounded-full border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all text-stone-800 placeholder:text-stone-400"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
              </form>

              {/* Cart Drawer Button */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="relative p-2.5 rounded-full text-stone-700 hover:text-rose-700 hover:bg-rose-50 transition-all flex items-center gap-2 group"
                aria-label="Shopping Cart"
              >
                <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-105" />
                <span className="hidden sm:inline-block text-xs font-semibold text-stone-700">
                  Bag
                </span>
                {totalItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {totalItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-5 py-4 space-y-3 shadow-lg">
            <form action="/flowers" method="GET" className="relative mb-3">
              <input
                type="text"
                name="q"
                placeholder="Search flowers, occasions..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-stone-100 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </form>
            <div className="flex flex-col space-y-2 text-sm font-medium text-stone-800">
              <Link
                href="/flowers"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-rose-600"
              >
                All Flowers & Bouquets
              </Link>
              <Link
                href="/flowers?occasion=Romance"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-rose-600"
              >
                Romance & Anniversaries
              </Link>
              <Link
                href="/flowers?category=birthday"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-rose-600"
              >
                Birthday Celebrations
              </Link>
              <Link
                href="/flowers?category=luxury"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-rose-600"
              >
                Grand Luxe Arrangements
              </Link>
              <Link
                href="/track-order"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-emerald-700 flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                Track Live Order
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
