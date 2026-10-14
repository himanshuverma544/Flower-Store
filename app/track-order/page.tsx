'use client';

import React, { useState, useEffect, Suspense, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Truck,
  CheckCircle2,
  Search,
  Package,
  Heart,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { Order } from '@/types';
import { formatINR } from '@/lib/currency';

const MOCK_DEMO_ORDER: Order = {
  id: 'FLX-829104',
  date: 'Today',
  status: 'Out for Hand Delivery',
  currentStep: 3,
  estimatedDelivery: 'Today by 1:30 PM',
  slot: 'Morning Window (9 AM - 1 PM)',
  driver: {
    name: 'Carlos Ruiz',
    van: 'Temperature-Safe Electric Van #04',
    temp: '44°F (Optimal Bloom Climate)',
  },
  recipient: {
    fullName: 'Camille Laurent',
    phone: '(555) 382-9102',
    address: '420 Bellevue Terrace, Apt 12B',
    apt: 'Apt 12B',
    city: 'San Francisco, CA',
    state: 'CA',
    zip: '94102',
    notes: 'Please ring bell',
  },
  sender: {
    senderName: 'David Chen',
    senderEmail: 'david.chen@example.com',
    senderPhone: '(555) 123-4567',
    keepSecret: false,
  },
  cardMessage: 'Happy 5th Anniversary my darling Camille! Five years with you feels like a dream.',
  items: [
    {
      id: 'fl-01',
      cartItemId: 1,
      slug: 'velvet-scarlet-grand-roses',
      name: 'Velvet Scarlet Grand Roses',
      selectedSize: { name: 'Deluxe (18 Stems)', price: 2399, multiplier: 1.34 },
      selectedVase: { id: 'fluted-glass', name: 'Fluted Crystal Glass Vase', price: 349, image: '/images/vases/glass.svg' },
      image: '/images/flowers/roses.svg',
      price: 2399,
      quantity: 1,
    },
  ],
  total: 2748,
};

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get('id');

  const [searchId, setSearchId] = useState<string>(queryId || '');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    try {
      const savedOrders: Order[] = JSON.parse(localStorage.getItem('floralux_orders') || '[]');
      if (queryId) {
        const found = savedOrders.find((o) => o.id.toLowerCase() === queryId.toLowerCase());
        if (found) {
          setActiveOrder(found);
          setSearchId(queryId);
          return;
        }
      }
      if (savedOrders.length > 0) {
        setActiveOrder(savedOrders[0]);
        setSearchId(savedOrders[0].id);
      } else {
        setActiveOrder(MOCK_DEMO_ORDER);
        setSearchId(MOCK_DEMO_ORDER.id);
      }
    } catch (e) {
      setActiveOrder(MOCK_DEMO_ORDER);
    }
  }, [queryId]);

  const handleTrackSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    try {
      const savedOrders: Order[] = JSON.parse(localStorage.getItem('floralux_orders') || '[]');
      const found = savedOrders.find(
        (o) => o.id.toLowerCase() === searchId.trim().toLowerCase()
      );

      if (found) {
        setActiveOrder(found);
        setErrorMessage('');
      } else if (searchId.trim().toUpperCase() === MOCK_DEMO_ORDER.id) {
        setActiveOrder(MOCK_DEMO_ORDER);
        setErrorMessage('');
      } else {
        setErrorMessage(`No order found matching "${searchId}". Try sample ID: ${MOCK_DEMO_ORDER.id}`);
      }
    } catch (err) {
      setActiveOrder(MOCK_DEMO_ORDER);
    }
  };

  const steps = [
    { title: 'Order Verified', desc: 'Stems reserved at morning cut' },
    { title: 'Master Florist Arranging', desc: 'Hand-tying stems & letterpress card' },
    { title: 'Out for Hand Delivery', desc: 'Chilled courier van en route' },
    { title: 'Safely Delivered', desc: 'Handed to recipient with care' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="text-xs uppercase font-bold tracking-widest text-emerald-700 flex items-center justify-center gap-1.5">
          <Truck className="w-4 h-4 text-emerald-600" />
          Live Courier GPS & Florist Status
        </span>
        <h1 className="text-3xl font-serif font-bold text-stone-900 mt-1">
          Track Your Flower Delivery
        </h1>
        <p className="text-stone-600 text-xs sm:text-sm mt-1">
          Monitor your bouquet from the morning cut table to the moment it brings a smile.
        </p>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm mb-8">
        <form onSubmit={handleTrackSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter Order Tracking ID (e.g. FLX-829104)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono uppercase"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors"
          >
            Track Status
          </button>
        </form>

        {errorMessage && (
          <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {activeOrder && (
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-lg overflow-hidden space-y-6">
          <div className="bg-stone-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Status: {activeOrder.status || 'En Route'}
              </div>
              <h2 className="text-2xl font-serif font-bold text-white mt-1">
                Order #{activeOrder.id}
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Target Arrival: <strong>{activeOrder.estimatedDelivery}</strong>
              </p>
            </div>

            <div className="bg-stone-800/80 px-4 py-3 rounded-2xl border border-stone-700 text-xs space-y-1">
              <div className="text-stone-400">Driver Courier:</div>
              <div className="font-semibold text-white">
                {activeOrder.driver?.name || 'Artisan Express Courier'}
              </div>
              <div className="text-[11px] text-emerald-400">
                ❄️ Cabin Chilled: {activeOrder.driver?.temp || '44°F Freshness Mode'}
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 py-6">
            <div className="relative">
              <div className="hidden sm:block absolute top-5 left-10 right-10 h-0.5 bg-stone-200 -z-0">
                <div
                  className="bg-emerald-600 h-full transition-all duration-700"
                  style={{
                    width: `${((activeOrder.currentStep || 2) / (steps.length - 1)) * 100}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative z-10">
                {steps.map((st, idx) => {
                  const isDone = idx < (activeOrder.currentStep || 2);
                  const isCurrent = idx === (activeOrder.currentStep || 2);

                  return (
                    <div key={idx} className="flex sm:flex-col items-center gap-3 sm:text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all flex-shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-rose-700 text-white ring-4 ring-rose-100'
                            : 'bg-stone-100 text-stone-400 border border-stone-300'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                      </div>
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            isCurrent
                              ? 'text-rose-700 font-bold'
                              : isDone
                              ? 'text-stone-900'
                              : 'text-stone-400'
                          }`}
                        >
                          {st.title}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{st.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-stone-100 pt-6">
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  Delivery Destination
                </h4>
                <div className="text-xs text-stone-700 space-y-0.5">
                  <div className="font-semibold text-stone-900">
                    {activeOrder.recipient?.fullName}
                  </div>
                  <div>{activeOrder.recipient?.address}</div>
                  <div>{activeOrder.recipient?.city}</div>
                </div>
              </div>

              {activeOrder.cardMessage && (
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    Hand-Lettered Sentiment Card
                  </h4>
                  <div className="font-serif italic text-xs text-stone-800 leading-relaxed">
                    "{activeOrder.cardMessage}"
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-rose-600" />
                Items In This Delivery ({activeOrder.items?.length || 1})
              </h4>

              <div className="space-y-3">
                {activeOrder.items?.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex gap-3 text-xs items-center"
                  >
                    {it.image && (
                      <div className="relative w-14 h-16 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                        <Image src={it.image} alt={it.name} fill className="object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-stone-900">{it.name}</div>
                      <div className="text-[11px] text-stone-500">
                        {it.selectedSize?.name || 'Standard'} • Qty {it.quantity || 1}
                      </div>
                      {it.selectedVase && (
                        <div className="text-[11px] text-stone-500">
                          Vase: {it.selectedVase.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-right text-xs text-stone-500">
                Total Paid:{' '}
                <strong className="text-stone-900 font-serif text-sm">
                  {formatINR(activeOrder.total || 0)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-stone-500 text-sm">
          Loading Order Tracking...
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
