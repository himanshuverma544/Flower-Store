# 🌸 FloraLux — Artisanal Floral E-Commerce

> A modern, high-performance flower delivery web application built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Node.js SQLite**.

---

## ✨ Key Features

### 🛍️ Floral Customer Experience
- **Artisanal Catalog:** Curated collection of roses, peonies, lilies, sunflowers, orchids, and everlasting dried florals with farm-fresh tags and stem counts.
- **Multidimensional Filtering & Search:** Filter by occasion (*Romance, Birthday, Sympathy, Congratulations, Anniversary*), flower variety, price ranges, and keyword search.
- **Bespoke Arrangement Customizer:**
  - Volume selection: *Standard, Deluxe, Grand Luxe*
  - Vessel & vase selector: *Fluted Glass Vase, Sculpted Ceramic, Antique Brass, Craft Paper Wrap*
  - Sweet add-ons: *Swiss Truffles, Scented Candle, Plush Bear, Floral Nutrition Elixir*
  - **Live Letterpress Greeting Card:** Interactive stationery preview with customizable font and sender sign-off.
- **Delivery Date & Slot Scheduler:** Choose same-day courier dispatch or schedule for a future date with custom delivery windows (*Morning, Afternoon, Evening*).
- **Interactive Cart & Drawer:** Slide-out drawer with free delivery progress bar, persistent state via localStorage, and instant promo code validation (`SPRING20` for 20% off, `FREEDELIVERY`).
- **3-Step Frictionless Checkout:** Recipient address, optional surprise sender privacy mode, mock payment processor with celebration confetti.
- **Live Order Tracking:** 4-stage floral delivery status, GPS driver courier info, chilled cabin temperature indicator, and recipient destination summary.

---

### 🚀 SEO & Performance Architecture
- **Server-Side Rendering (SSR) & Static Generation (SSG)**: Lightning-fast initial page loads.
- **Schema.org Florist Microdata**: Embedded JSON-LD structured data for Google Search rich snippets.
- **Dynamic XML Sitemap (`/sitemap.xml`) & `robots.txt`**: Automatically indexes all floral bouquets.
- **OpenGraph & Twitter Cards**: High-resolution image previews when sharing links on social platforms.
- **Native Relational Storage**: Zero-dependency SQLite engine using Node.js native `DatabaseSync` for orders.

---

## 🛠️ Project Structure

```
flower-store/
├── app/
│   ├── layout.jsx            # Root layout with SEO meta & CartProvider
│   ├── page.jsx              # Landing page (Hero, Categories, Bestsellers, Reviews)
│   ├── globals.css           # Tailwind base styles and floral palette
│   ├── sitemap.js            # Dynamic SEO sitemap generator
│   ├── robots.js             # Search crawler directives
│   ├── flowers/
│   │   └── page.jsx          # Filterable catalog with search & occasion tags
│   ├── flower/[slug]/
│   │   └── page.jsx          # Bouquet customizer, card writer, delivery scheduler
│   ├── checkout/
│   │   └── page.jsx          # 3-step checkout with simulated payment & confetti
│   ├── track-order/
│   │   └── page.jsx          # Live 4-stage delivery tracker
│   └── api/
│       ├── products/route.js # REST API for flowers
│       ├── orders/route.js   # Order storage in SQLite
│       └── coupons/route.js  # Promo code validation
├── components/
│   ├── Navbar.jsx            # Header, search, and reactive bag counter
│   ├── Footer.jsx            # 4 trust pillars, newsletter, and customer care
│   ├── FlowerCard.jsx        # Bouquet preview cards with ratings and quick CTA
│   └── CartDrawer.jsx        # Slide-out bag with free shipping progress bar
├── context/
│   └── CartContext.jsx       # Cart state, discounts, add-ons & localStorage persistence
├── lib/
│   ├── data.js               # Floral catalog, pricing, care tips, testimonials
│   └── db.js                 # SQLite database helper
└── tailwind.config.js        # Floral blossom & botanical sage design theme
```

---

## 🏃 Running Locally

```bash
# Start development server
npm run dev

# Or run optimized production build
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.
