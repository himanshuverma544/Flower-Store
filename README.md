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

---

## 💳 Razorpay Payment Verification & Webhooks (Stage 2C)

### 1. Server-Side Verification Endpoint
- **Route:** `POST /api/payments/verify`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "orderId": "FLX-123456",
    "razorpayOrderId": "order_XXXXX",
    "razorpayPaymentId": "pay_YYYYY",
    "razorpaySignature": "computed_hmac_hex",
    "trackingToken": "unguessable_secure_token"
  }
  ```
- **Security & Authorization:**
  - Verifies HMAC SHA256 signature using `RAZORPAY_KEY_SECRET`.
  - Enforces server-authoritative Razorpay order ID (never trusts client-supplied order ID).
  - Fetches payment details from Razorpay to verify capture status (`captured`), amount (paise), and currency (`INR`).
  - Idempotent: duplicate calls with the same payment ID return verified state safely without re-processing.
  - Conflicting payment IDs attempting to overwrite an already-verified order are rejected with `409 Conflict`.
  - Atomically commits coupon reservations via `commitCouponAtomically`.

### 2. Razorpay Webhook Configuration
- **Endpoint URL:** `https://<your-deployed-domain>/api/webhooks/razorpay` (or ngrok/tunnel URL for local webhook testing).
- **Header:** `X-Razorpay-Signature`
- **Environment Variable:** `RAZORPAY_WEBHOOK_SECRET`
  > [!IMPORTANT]
  > The webhook secret is a **separate secret** generated when adding a webhook endpoint in the Razorpay Dashboard.
  > Never use `RAZORPAY_KEY_SECRET` in place of `RAZORPAY_WEBHOOK_SECRET`.
- **Supported Events:**
  - `payment.captured` — Transitions order to `'Order Received & Verified'` and commits coupon reservation.
  - `order.paid` — Transitions order to `'Order Received & Verified'` and commits coupon reservation.
  - `payment.failed` — Transitions `'Payment Pending'` order to `'Payment Failed'` and releases reserved coupon. If an order was already confirmed/paid, a delayed failure event is ignored to prevent downgrade.
- **Deduplication:**
  - Every event is deduplicated atomically in `payload.payload_kv` under `webhook_event:<eventId>`.

#### Razorpay Dashboard Setup Steps:
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/) (ensure **Test Mode** is toggled for development).
2. Navigate to **Account & Settings** → **Webhooks** → **Add New Webhook**.
3. Set **Webhook URL** to `https://<your-domain>/api/webhooks/razorpay`.
4. Enter a strong, random string in the **Secret** field and save this as `RAZORPAY_WEBHOOK_SECRET` in your `.env`.
5. Select the following **Active Events**:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`
6. Click **Create Webhook**.

> [!NOTE]
> **Checkout Credential Status:** The Checkout modal's API key expiration is currently under investigation with Razorpay Support. Server-side payment verification and webhook processing are implemented and tested independently with cryptographic fixtures and mock suites.

