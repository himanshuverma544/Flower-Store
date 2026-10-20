'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Sparkles, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';
import { FLORIST_PERKS } from '@/lib/data';

export default function Footer() {
  const [email, setEmail] = useState<string>('');
  const [subscribed, setSubscribed] = useState<boolean>(false);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
  };

  return (
    <footer className="bg-stone-900 text-stone-300 mt-24 border-t border-stone-800">
      {/* 4 Pillars Bar */}
      <div className="border-b border-stone-800 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FLORIST_PERKS.map((perk, idx) => (
            <div key={idx} className="flex items-start space-x-4">
              <div className="p-3 rounded-2xl bg-stone-800/80 text-rose-400 border border-stone-700 flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white tracking-wide">{perk.title}</h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">{perk.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Footer Links & Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-serif text-3xl font-medium tracking-tight text-white">
                Flora<span className="text-rose-400 italic">Lux</span>
              </span>
            </Link>
            <p className="text-xs text-stone-400 leading-relaxed max-w-sm">
              We curate farm-fresh, sustainable blooms from world-renowned growers and handcraft each bouquet with artistic devotion. Delivered in our signature temperature-safe gift box.
            </p>
            <div className="flex items-center gap-3 pt-2 text-stone-400 text-xs">
              <span className="inline-flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% Bloom Satisfaction Guarantee
              </span>
            </div>
          </div>

          {/* Floral Collections */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-400">
              <li>
                <Link href="/flowers" className="hover:text-rose-300 transition-colors">
                  All Floral Bouquets
                </Link>
              </li>
              <li>
                <Link href="/flowers?category=romance" className="hover:text-rose-300 transition-colors">
                  Ecuadorian Roses
                </Link>
              </li>
              <li>
                <Link href="/flowers?category=luxury" className="hover:text-rose-300 transition-colors">
                  Grand Luxe Peonies
                </Link>
              </li>
              <li>
                <Link href="/flowers?category=dried" className="hover:text-rose-300 transition-colors">
                  Everlasting Dried Botanicals
                </Link>
              </li>
              <li>
                <Link href="/flowers?category=birthday" className="hover:text-rose-300 transition-colors">
                  Birthday Bouquets
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-400">
              <li>
                <Link href="/track-order" className="hover:text-rose-300 transition-colors">
                  Track Delivery
                </Link>
              </li>
              <li>
                <Link href="/flowers" className="hover:text-rose-300 transition-colors">
                  Flower Care Instructions
                </Link>
              </li>
              <li>
                <span className="hover:text-rose-300 transition-colors cursor-pointer">
                  Same-Day Delivery FAQ
                </span>
              </li>
              <li>
                <span className="hover:text-rose-300 transition-colors cursor-pointer">
                  Corporate & Event Gifting
                </span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Join The Bloom Club
            </h4>
            <p className="text-xs text-stone-400 mb-3">
              Receive 15% off your next bouquet and weekly botanical styling inspiration.
            </p>
            {subscribed ? (
              <div className="bg-emerald-950/60 border border-emerald-700/60 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Welcome! Check your inbox for code <strong>BLOOM15</strong>.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2" suppressHydrationWarning>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    suppressHydrationWarning
                    className="w-full px-3 py-2 text-xs bg-stone-800 rounded-lg border border-stone-700 text-white placeholder:text-stone-500 focus:outline-none focus:border-rose-400"
                  />
                  <Mail className="w-3.5 h-3.5 text-stone-500 absolute right-3 top-2.5" />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Subscribe & Save 15%
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-stone-800/80 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© {new Date().getFullYear()} FloraLux Artisanal Florals Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Freshness Guaranteed</span>
            <span>Eco-Friendly Wrapping</span>
            <span>Secure SSL Checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
