'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, Search, RotateCcw, Sparkles } from 'lucide-react';
import FlowerCard from '@/components/FlowerCard';
import { PRODUCTS, OCCASIONS } from '@/lib/data';

const FLOWER_TYPES: string[] = ['All', 'Roses', 'Peonies', 'Sunflowers', 'Lilies', 'Tulips', 'Orchids', 'Dried Bouquets'];
const PRICE_RANGES = [
  { id: 'all', label: 'All Prices' },
  { id: 'under-1500', label: 'Under ₹1,500' },
  { id: '1500-2000', label: '₹1,500 to ₹2,000' },
  { id: 'over-2000', label: '₹2,000 & Above' },
];

function FlowersCatalogContent() {
  const searchParams = useSearchParams();
  const initialOccasion = searchParams.get('occasion') || 'All';
  const initialCategory = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [selectedOccasion, setSelectedOccasion] = useState<string>(initialOccasion);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesTagline = item.tagline.toLowerCase().includes(q);
        const matchesFlower = item.flowerType.toLowerCase().includes(q);
        if (!matchesName && !matchesTagline && !matchesFlower) return false;
      }

      if (selectedOccasion !== 'All') {
        if (!item.occasion.includes(selectedOccasion)) return false;
      }

      if (initialCategory !== 'all' && selectedOccasion === 'All') {
        if (item.category !== initialCategory) return false;
      }

      if (selectedType !== 'All') {
        if (!item.flowerType.toLowerCase().includes(selectedType.toLowerCase())) return false;
      }

      if (selectedPriceRange === 'under-1500' && item.price >= 1500) return false;
      if (selectedPriceRange === '1500-2000' && (item.price < 1500 || item.price > 2000)) return false;
      if (selectedPriceRange === 'over-2000' && item.price <= 2000) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });
  }, [searchQuery, selectedOccasion, initialCategory, selectedType, selectedPriceRange, sortBy]);

  const handleResetFilters = () => {
    setSelectedOccasion('All');
    setSelectedType('All');
    setSelectedPriceRange('all');
    setSortBy('featured');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedOccasion !== 'All' ||
    selectedType !== 'All' ||
    selectedPriceRange !== 'all' ||
    searchQuery !== '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <span className="text-xs uppercase font-bold tracking-widest text-rose-700">Artisan Catalog</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 mt-1">
          Handcrafted Fresh Bouquets & Arrangements
        </h1>
        <p className="text-stone-600 text-sm mt-1 max-w-2xl">
          Cut fresh daily and hand-tied with custom stationery. Explore our curated selection of roses, peonies, lilies, and sustainable dried botanicals.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by flower name, variety..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-stone-800"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <span className="text-xs text-stone-500 whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-medium"
            >
              <option value="featured">Featured / Best Sellers</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1 pl-2 border-l border-stone-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <span className="text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Occasion:
          </span>
          {OCCASIONS.map((occ) => (
            <button
              key={occ}
              onClick={() => setSelectedOccasion(occ)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedOccasion === occ
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {occ}
            </button>
          ))}
        </div>

        <div className="pt-2 flex flex-wrap gap-4 items-center text-xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <span className="font-semibold text-stone-500">Flower:</span>
            {FLOWER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedType === type
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-200/70 border border-stone-200/60'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-500">Price:</span>
            {PRICE_RANGES.map((pr) => (
              <button
                key={pr.id}
                onClick={() => setSelectedPriceRange(pr.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedPriceRange === pr.id
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-200/70 border border-stone-200/60'
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-stone-500">
          Showing <span className="font-bold text-stone-800">{filteredProducts.length}</span> blooms
        </p>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
          {filteredProducts.map((flower) => (
            <FlowerCard key={flower.id} flower={flower} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 p-8">
          <Sparkles className="w-10 h-10 text-rose-300 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-semibold text-stone-800">No matching bouquets found</h3>
          <p className="text-stone-500 text-xs mt-1 max-w-sm mx-auto">
            Try resetting your filters or searching for another variety like roses, peonies, or sunflowers.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-5 px-5 py-2 bg-rose-700 text-white text-xs font-semibold rounded-xl hover:bg-rose-800 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default function FlowersCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-stone-500 text-sm">
          Loading Floral Collection...
        </div>
      }
    >
      <FlowersCatalogContent />
    </Suspense>
  );
}
