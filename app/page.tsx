'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Heart, Star } from 'lucide-react';
import FlowerCard from '@/components/FlowerCard';
import { PRODUCTS, TESTIMONIALS, CATEGORIES } from '@/lib/data';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredProducts =
    selectedCategory === 'all'
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === selectedCategory);

  const bestsellers = PRODUCTS.filter((p) => p.isBestseller);

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
                Artisanal Blooms, Cut Sunrise Daily & <span className="text-rose-700 italic font-normal">Delivered Fresh.</span>
              </h1>

              <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto lg:mx-0 font-light leading-relaxed">
                Elevate life’s treasured milestones with farm-direct flowers. Handcrafted by master florists, accompanied by letterpress cards and delivered in temperature-safe hydration packaging.
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
                    src="/images/flowers/peonies.svg"
                    alt="Signature FloraLux Hand-tied Bouquet"
                    fill
                    priority
                    className="object-cover object-center"
                  />
                  
                  {/* Floating Card: Today's Special */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-stone-200/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-rose-700">Florist Choice of the Day</span>
                        <h4 className="font-serif font-bold text-stone-900 text-sm">Provence Coral Charm Peonies</h4>
                        <div className="text-xs text-stone-500 mt-0.5">Includes free bespoke glass vase</div>
                      </div>
                      <Link
                        href="/flower/provence-peach-peonies"
                        className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Gift Now
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Decorative floating badge */}
                <div className="absolute -top-4 -right-4 bg-white p-3 rounded-2xl shadow-lg border border-stone-100 flex items-center gap-2 animate-float">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-500">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900">4.9 / 5 Rating</div>
                    <div className="text-[10px] text-stone-500">12,400+ Delivered</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Occasions / Category Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-xs uppercase font-bold tracking-widest text-rose-700">Curated For Moments</span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Shop By Occasion & Botanical Style
          </h2>
        </div>

        {/* Category Pills */}
        <div className="flex items-center justify-center gap-2.5 overflow-x-auto pb-4 custom-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 border ${
                selectedCategory === cat.id
                  ? 'bg-rose-800 text-white border-rose-800 shadow-md scale-105'
                  : 'bg-white text-stone-700 border-stone-200/90 hover:border-rose-300 hover:bg-rose-50/50'
              }`}
            >
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Filtered Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mt-8">
          {filteredProducts.slice(0, 4).map((flower) => (
            <FlowerCard key={flower.id} flower={flower} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/flowers"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 hover:text-rose-900 border-b-2 border-rose-700 pb-1 hover:border-rose-900 transition-all"
          >
            <span>View Complete Floral Collection ({PRODUCTS.length} Bouquets)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* The FloraLux Difference: How It Works */}
      <section className="bg-stone-100/70 border-y border-stone-200/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-bold tracking-widest text-rose-700">Artisan Care</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
              How Your Blooms Travel To Their Door
            </h2>
            <p className="text-stone-600 text-xs sm:text-sm mt-2">
              Every detail is engineered to ensure flowers arrive looking as fresh as the morning they were harvested.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-stone-200/70 shadow-sm relative">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm mb-4">
                01
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Select Your Blooms</h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Choose from long-stem roses, ruffled peonies, sweet lilies, or everlasting dried botanicals.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/70 shadow-sm relative">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm mb-4">
                02
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Personalize With A Note</h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Write your heartfelt message printed on heavy-weight stationery, and pick an optional bespoke glass vase.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/70 shadow-sm relative">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm mb-4">
                03
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Schedule The Date</h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Choose same-day delivery or book an exact future date so you never miss an anniversary or birthday.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/70 shadow-sm relative">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm mb-4">
                04
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Hydrated Hand Delivery</h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Delivered in protective chilled vans with stems cushioned in our patented hydration pack.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bestsellers Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-rose-700">Most Loved</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
              Customer Favorite Bestsellers
            </h2>
          </div>
          <Link
            href="/flowers"
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center gap-1"
          >
            <span>See All Bestsellers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {bestsellers.slice(0, 3).map((flower) => (
            <FlowerCard key={flower.id} flower={flower} />
          ))}
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="bg-rose-950 text-white rounded-3xl p-8 sm:p-12 lg:p-16 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs uppercase tracking-widest text-rose-300 font-bold">Heartfelt Words</span>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold mt-2">
              Loved by Over 12,000 Recipients Nationwide
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 relative z-10">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.id}
                className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-1 text-amber-300 mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-300" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-rose-100/90 leading-relaxed italic">
                    "{t.comment}"
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{t.name}</div>
                    <div className="text-[11px] text-rose-300/80">{t.location}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-rose-200 bg-white/10 px-2 py-0.5 rounded-full">
                    {t.flower}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
