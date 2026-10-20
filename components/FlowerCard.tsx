'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Sparkles } from 'lucide-react';
import { Product } from '@/types';
import { formatINR } from '@/lib/currency';

interface FlowerCardProps {
  flower: Product;
}

export default function FlowerCard({ flower }: FlowerCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
      {/* Top Image Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone-100">
        <Image
          src={flower.image}
          alt={flower.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {flower.isBestseller && (
            <span className="bg-rose-900/90 backdrop-blur-sm text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Bestseller
            </span>
          )}
          {flower.isNew && (
            <span className="bg-emerald-800/90 backdrop-blur-sm text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              New Harvest
            </span>
          )}
          {flower.originalPrice > flower.price && (
            <span className="bg-amber-600/90 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
              Save {formatINR(flower.originalPrice - flower.price)}
            </span>
          )}
        </div>

        {/* Stem count pill */}
        <div className="absolute bottom-3 right-3 bg-stone-900/70 backdrop-blur-md text-stone-100 text-[11px] px-2.5 py-1 rounded-full font-medium">
          {flower.stemCount} Hand-Tied Stems
        </div>
      </div>

      {/* Info Container */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Flower Variety / Category & Rating */}
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-rose-800">
              {flower.flowerType}
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{flower.rating}</span>
              <span className="text-stone-400 font-normal">({flower.reviewCount})</span>
            </div>
          </div>

          {/* Name & Tagline */}
          <Link href={`/flower/${flower.slug}`}>
            <h3 className="font-serif text-lg font-medium text-stone-900 group-hover:text-rose-700 transition-colors line-clamp-1">
              {flower.name}
            </h3>
          </Link>
          <p className="text-stone-500 text-xs mt-1 line-clamp-2 leading-relaxed">
            {flower.tagline}
          </p>
        </div>

        {/* Price & Action Button */}
        <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-stone-400 font-medium">Starts from</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-stone-900 font-serif">
                {formatINR(flower.price)}
              </span>
              {flower.originalPrice > flower.price && (
                <span className="text-xs text-stone-400 line-through">
                  {formatINR(flower.originalPrice)}
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/flower/${flower.slug}`}
            className="px-4 py-2 bg-stone-900 hover:bg-rose-700 text-white text-[10px] font-semibold rounded-xl transition-all shadow-sm hover:shadow"
          >
            Customize & Gift
          </Link>
        </div>
      </div>
    </div>
  );
}
