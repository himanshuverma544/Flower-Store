'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Heart, Star } from 'lucide-react';
import FlowerCard from '@/components/FlowerCard';
import { Product, Category } from '@/types';
import { TESTIMONIALS } from '@/lib/data';
import { SiteSettings } from '@/lib/payload';

interface HomeClientViewProps {
  products: Product[];
  categories: Category[];
  siteSettings?: SiteSettings;
}

export default function HomeClientView({
  products,
  categories,
  siteSettings,
}: HomeClientViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const bestsellers = products.filter((p) => p.isBestseller);

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pb-24 lg:pt-16 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-900 text-xs font-semibold tracking-wide border border-rose-200">
                <Sparkles className="w-3.5 h-3.5 text-rose-600 animate-spin" />
                <span>Autumn / Spring 2026 Floral Curation</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-stone-900 tracking-tight leading-[1.12]">
                Artisanal Blooms, Cut Sunrise Daily &{' '}
                <span className="text-rose-700 italic font-normal">Delivered Fresh.</span>
              </h1>

              <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto lg:mx-0 font-light leading-relaxed">
                {siteSettings?.tagline ||
                  'Elevate life’s treasured milestones with farm-direct flowers. Handcrafted by master florists, accompanied by letterpress cards and delivered in temperature-safe hydration packaging.'}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/flowers"
                  className="w-full sm:w-auto px-8 py-4 bg-rose-700 hover:bg-rose-800 text-white font-medium text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Explore All Bouquets</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/flowers?occasion=Romance"
                  className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-stone-50 text-stone-800 font-medium text-sm rounded-xl border border-stone-200 shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4 text-rose-600" />
                  <span>Send Roses & Romance</span>
                </Link>
              </div>

              {/* Quick Trust Badges */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-stone-200 text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900">100%</div>
                  <div className="text-xs text-stone-500 font-medium">Farm Direct Stems</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900">7-Day</div>
                  <div className="text-xs text-stone-500 font-medium">Freshness Guarantee</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-serif font-bold text-stone-900">Same-Day</div>
                  <div className="text-xs text-stone-500 font-medium">Hand Delivery Before 2PM</div>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Feature */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <Image
                    src={bestsellers[0]?.image || '/images/flowers/peonies.svg'}
                    alt={bestsellers[0]?.name || 'Signature FloraLux Hand-tied Bouquet'}
                    fill
                    priority
                    className="object-cover object-center"
                  />

                  {/* Floating Card: Today's Special */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-stone-200/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-rose-700">
                          Florist Choice of the Day
                        </span>
                        <h4 className="font-serif font-bold text-stone-900 text-sm">
                          {bestsellers[0]?.name || 'Provence Coral Charm Peonies'}
                        </h4>
                        <div className="text-xs text-stone-500 mt-0.5">Includes free bespoke glass vase</div>
                      </div>
                      <Link
                        href={`/flower/${bestsellers[0]?.slug || 'provence-peach-peonies'}`}
                        className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Order Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills & Main Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-serif font-bold text-stone-900">
              The Seasonal Collection
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              Select an occasion or style to view tailored hand-tied stems.
            </p>
          </div>

          <Link
            href="/flowers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors"
          >
            <span>View All ({products.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${
                selectedCategory === cat.id
                  ? 'bg-rose-700 text-white border-rose-700 shadow-sm'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pt-4">
          {filteredProducts.map((flower) => (
            <FlowerCard key={flower.id} flower={flower} />
          ))}
        </div>

        <div className="text-center pt-12">
          <Link
            href="/flowers"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white border border-stone-300 hover:border-stone-400 text-stone-800 font-medium text-xs rounded-xl shadow-sm transition-all hover:bg-stone-50"
          >
            <span>View Complete Floral Collection ({products.length} Bouquets)</span>
            <ArrowRight className="w-4 h-4 text-stone-500" />
          </Link>
        </div>
      </section>

      {/* Bestsellers Spotlight */}
      <section className="bg-stone-900 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-xs uppercase font-bold tracking-widest text-rose-400">
              Customer Favorites
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mt-1">
              Beloved Arrangements
            </h2>
            <p className="text-sm text-stone-400 mt-2">
              Our most coveted stems, ranked by recipient delight and repeat orders.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {bestsellers.slice(0, 4).map((flower) => (
              <FlowerCard key={flower.id} flower={flower} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase font-bold tracking-widest text-rose-600">
            Real Moments of Joy
          </span>
          <h2 className="text-3xl font-serif font-bold text-stone-900 mt-1">
            Sent with Love, Received with Wonder
          </h2>
          <p className="text-sm text-stone-500 mt-2">
            Read unfiltered impressions from recipients across the nation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-stone-700 text-sm leading-relaxed italic mb-6">
                  &ldquo;{t.comment}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-stone-900">{t.name}</h4>
                  <div className="text-[11px] text-stone-400">{t.location}</div>
                </div>
                <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                  {t.flower}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
