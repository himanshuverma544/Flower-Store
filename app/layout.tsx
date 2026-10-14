import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import { CartProvider } from '@/context/CartContext';
import { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'FloraLux | Luxury Flower Delivery & Artisanal Fresh Blooms',
  description:
    'Send handcrafted fresh bouquets, long-stem Ecuadorian roses, peonies, and everlasting florals. Same-day white-glove hand delivery, complimentary handwritten card, and 7-day freshness guarantee.',
  keywords: [
    'flower delivery',
    'luxury flowers',
    'same day flower delivery',
    'fresh roses',
    'anniversary flowers',
    'birthday bouquet',
    'peonies',
    'artisanal florist',
  ],
  authors: [{ name: 'FloraLux Botanicals' }],
  openGraph: {
    title: 'FloraLux | Artisanal Blooms & Same-Day Flower Delivery',
    description:
      'Farm-fresh cut blooms hand-tied with love. Order online for scheduled delivery with custom gift cards and vases.',
    url: 'https://floralux-boutique.com',
    siteName: 'FloraLux Flowers',
    images: [
      {
        url: '/images/flowers/roses.svg',
        width: 1200,
        height: 630,
        alt: 'FloraLux Luxury Red Roses',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FloraLux | Luxury Flower Delivery',
    description: 'Farm-fresh cut flowers hand-tied by master florists. Same-day delivery available.',
    images: ['/images/flowers/roses.svg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Florist',
    name: 'FloraLux Artisanal Florals',
    image: 'https://floralux-boutique.com/images/flowers/roses.svg',
    description:
      'Luxury florist delivering fresh cut flowers, Ecuadorian roses, and bespoke arrangements with same-day delivery.',
    priceRange: '₹₹',
    currenciesAccepted: 'INR',
    paymentAccepted: 'Credit Card, Apple Pay, Google Pay',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '08:00',
        closes: '20:00',
      },
    ],
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans bg-[#FAF8F5]">
        <CartProvider>
          <Navbar />
          <CartDrawer />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
