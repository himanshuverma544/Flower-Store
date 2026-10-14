'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  Star,
  Sparkles,
  Heart,
  Truck,
  ShieldCheck,
  Clock,
  Gift,
  Check,
  Droplets,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { PRODUCTS, VASE_OPTIONS, GIFT_ADDONS, CARD_TEMPLATES } from '@/lib/data';
import { useCart } from '@/context/CartContext';
import { formatINR } from '@/lib/currency';
import { FlowerSize, VaseOption, GiftAddon, CardTemplate } from '@/types';

export default function FlowerDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const flower = PRODUCTS.find((p) => p.slug === slug);

  if (!flower) {
    return notFound();
  }

  const { addToCart } = useCart();

  // State
  const [selectedImage, setSelectedImage] = useState<string>(flower.gallery[0] || flower.image);
  const [selectedSize, setSelectedSize] = useState<FlowerSize>(flower.sizes[0]);
  const [selectedVase, setSelectedVase] = useState<VaseOption>(VASE_OPTIONS[0]);
  const [selectedAddons, setSelectedAddons] = useState<GiftAddon[]>([]);
  
  // Custom Card State
  const [includeCard, setIncludeCard] = useState<boolean>(true);
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>(CARD_TEMPLATES[0]);
  const [cardMessage, setCardMessage] = useState<string>('Wishing you a day filled with sunshine, love, and sweet blooms!');
  const [cardSender, setCardSender] = useState<string>('');

  // Delivery Scheduler State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [deliveryDate, setDeliveryDate] = useState<string>(defaultDateStr);
  const [deliverySlot, setDeliverySlot] = useState<string>('Morning (9 AM - 1 PM)');
  const [isSameDay, setIsSameDay] = useState<boolean>(false);

  // Success Feedback
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  const toggleAddon = (addon: GiftAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const calculatedPrice =
    selectedSize.price +
    selectedVase.price +
    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const handleAddToCart = () => {
    addToCart({
      id: flower.id,
      slug: flower.slug,
      name: flower.name,
      image: flower.image,
      price: flower.price,
      quantity: 1,
      selectedSize,
      selectedVase,
      addons: selectedAddons,
      cardMessage: includeCard ? cardMessage : '',
      cardSender: includeCard ? cardSender : '',
      cardTemplate: includeCard ? cardTemplate.name : '',
      deliveryDate: isSameDay ? 'Today (Same-Day Hand Delivery)' : deliveryDate,
      deliverySlot,
    });

    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back to Catalog Link */}
      <div className="mb-6">
        <Link
          href="/flowers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-rose-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Bouquets</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14">
        {/* Left Gallery Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-stone-100 shadow-md border border-stone-200/80">
            <Image
              src={selectedImage}
              alt={flower.name}
              fill
              priority
              className="object-cover object-center"
            />
            {flower.isBestseller && (
              <span className="absolute top-4 left-4 bg-rose-900/90 backdrop-blur-sm text-white text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Bestseller
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {flower.gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {flower.gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImage === img
                      ? 'border-rose-600 ring-2 ring-rose-200'
                      : 'border-stone-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Flower Symbolism Card */}
          <div className="bg-rose-50/70 border border-rose-100/90 rounded-2xl p-5 mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              Flower Language & Meaning
            </h4>
            <p className="text-xs text-rose-950/80 mt-1.5 leading-relaxed italic">
              "{flower.symbolism}"
            </p>
          </div>

          {/* Care Tips Accordion Box */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-emerald-600" />
              Florist Care Instructions
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              {flower.careTips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Product Configurator Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Header Info */}
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span className="font-bold uppercase tracking-wider text-rose-700">
                {flower.flowerType} • {flower.stemCount} Stems
              </span>
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{flower.rating}</span>
                <span className="text-stone-400 font-normal">({flower.reviewCount} reviews)</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900">
              {flower.name}
            </h1>
            <p className="text-stone-600 text-sm mt-2 leading-relaxed font-light">
              {flower.description}
            </p>
          </div>

          {/* Price & Summary Tag */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-500 font-medium">Arrangement Total:</span>
              <div className="text-2xl font-serif font-bold text-stone-900">
                {formatINR(calculatedPrice)}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> 7-Day Bloom Guaranteed
              </span>
            </div>
          </div>

          {/* Step 1: Choose Arrangement Size */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center justify-between">
              <span>Step 1: Choose Bouquet Stem Volume</span>
              <span className="text-rose-700 font-normal lowercase">{selectedSize.name}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {flower.sizes.map((sz) => (
                <button
                  key={sz.name}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    selectedSize.name === sz.name
                      ? 'border-rose-700 bg-rose-50/50 ring-1 ring-rose-700'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-stone-900">{sz.name}</div>
                  <div className="text-sm font-bold text-stone-800 font-serif mt-1">
                    {formatINR(sz.price)}
                  </div>
                  {selectedSize.name === sz.name && (
                    <div className="absolute top-3 right-3 text-rose-700">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Choose Vessel / Vase */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
              Step 2: Select Presentation & Vase
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VASE_OPTIONS.map((vase) => (
                <button
                  key={vase.id}
                  type="button"
                  onClick={() => setSelectedVase(vase)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    selectedVase.id === vase.id
                      ? 'border-rose-700 bg-rose-50/50 ring-1 ring-rose-700'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                    <Image src={vase.image} alt={vase.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {vase.name}
                    </div>
                    <div className="text-xs text-stone-500 font-medium">
                      {vase.price === 0 ? 'Included (Complimentary)' : `+${formatINR(vase.price)}`}
                    </div>
                  </div>
                  {selectedVase.id === vase.id && (
                    <Check className="w-4 h-4 text-rose-700 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Gift Add-ons */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
              Step 3: Sweet Add-Ons & Botanicals (Optional)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {GIFT_ADDONS.map((addon) => {
                const isChecked = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isChecked
                        ? 'border-rose-700 bg-rose-50/60 ring-1 ring-rose-700'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Gift className="w-4 h-4 text-rose-600" />
                      {isChecked && <Check className="w-3.5 h-3.5 text-rose-700" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-stone-900 leading-tight">
                        {addon.name}
                      </div>
                      <div className="text-xs font-bold text-stone-700 mt-1">+{formatINR(addon.price)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Handwritten Stationery Card */}
          <div className="space-y-3 p-5 rounded-2xl bg-amber-50/40 border border-amber-200/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-rose-600" />
                Step 4: Complimentary Hand-Lettered Card
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-amber-900">
                <input
                  type="checkbox"
                  checked={includeCard}
                  onChange={(e) => setIncludeCard(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                Include Greeting Card
              </label>
            </div>

            {includeCard && (
              <div className="space-y-4 pt-2">
                {/* Theme picker */}
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {CARD_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setCardTemplate(tmpl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                        cardTemplate.id === tmpl.id
                          ? 'border-rose-700 bg-rose-100/70 font-semibold'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>

                {/* Card input */}
                <div>
                  <textarea
                    rows={3}
                    placeholder="Enter your heartfelt message..."
                    value={cardMessage}
                    onChange={(e) => setCardMessage(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white text-stone-800"
                    maxLength={240}
                  />
                  <div className="text-[11px] text-stone-400 text-right mt-0.5">
                    {cardMessage.length} / 240 characters
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Signature / From (e.g. 'Always, Sarah')"
                    value={cardSender}
                    onChange={(e) => setCardSender(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white"
                  />
                </div>

                {/* Live Card Preview */}
                <div className="mt-3 p-4 rounded-xl border-2 border-dashed border-rose-300 bg-white shadow-sm">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-rose-500 mb-1">
                    Card Preview ({cardTemplate.name})
                  </div>
                  <div className="font-serif italic text-stone-800 text-sm leading-relaxed">
                    "{cardMessage || 'Your message here...'}"
                  </div>
                  {cardSender && (
                    <div className="text-right font-serif font-bold text-xs text-stone-700 mt-2">
                      — {cardSender}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 5: Delivery Date & Slot Scheduler */}
          <div className="space-y-3 p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-700" />
              Step 5: Schedule Delivery Date & Slot
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Delivery Date:
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => {
                      setDeliveryDate(e.target.value);
                      setIsSameDay(false);
                    }}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-stone-800"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSameDay(!isSameDay)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      isSameDay
                        ? 'bg-rose-700 text-white'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    ⚡ Same-Day
                  </button>
                </div>
              </div>

              {/* Delivery Window */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Delivery Window:
                </label>
                <select
                  value={deliverySlot}
                  onChange={(e) => setDeliverySlot(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-stone-800 font-medium"
                >
                  <option value="Morning (9 AM - 1 PM)">Morning (9 AM - 1 PM)</option>
                  <option value="Afternoon (1 PM - 5 PM)">Afternoon (1 PM - 5 PM)</option>
                  <option value="Evening (5 PM - 8 PM)">Evening (5 PM - 8 PM)</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Same-day cutoff is 2:00 PM local time. Vans are chilled to 45°F to ensure petal crispness.
            </p>
          </div>

          {/* Add to Bag CTA */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full py-4 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              <span>Add Handcrafted Bouquet to Bag — {formatINR(calculatedPrice)}</span>
            </button>

            {addedSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Successfully added to your bag! Opening drawer...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
