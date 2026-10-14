import {
  Category,
  Product,
  VaseOption,
  GiftAddon,
  CardTemplate,
  Testimonial,
  FloristPerk,
} from '@/types';

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'All Blooms', icon: 'Sparkles' },
  { id: 'romance', name: 'Romance & Anniversary', icon: 'Heart' },
  { id: 'birthday', name: 'Birthday Joy', icon: 'Gift' },
  { id: 'sympathy', name: 'Sympathy & Comfort', icon: 'Feather' },
  { id: 'congratulations', name: 'Congratulations', icon: 'Award' },
  { id: 'luxury', name: 'Grand Luxe Collection', icon: 'Crown' },
  { id: 'dried', name: 'Dried & Everlasting', icon: 'Sun' },
];

export const OCCASIONS: string[] = [
  'All',
  'Romance',
  'Birthday',
  'Anniversary',
  'Sympathy',
  'Congratulations',
  'Thank You',
  'Just Because',
];

export const VASE_OPTIONS: VaseOption[] = [
  { id: 'no-vase', name: 'Wrapped in Craft Burlap & Ribbon (No Vase)', price: 0, image: '/images/vases/burlap.svg' },
  { id: 'fluted-glass', name: 'Fluted Crystal Glass Vase', price: 349, image: '/images/vases/glass.svg' },
  { id: 'sculpted-ceramic', name: 'Matte Cream Sculpted Ceramic Vase', price: 499, image: '/images/vases/ceramic.svg' },
  { id: 'brass-urn', name: 'Heritage Antique Brass Vase', price: 699, image: '/images/vases/brass.svg' },
];

export const GIFT_ADDONS: GiftAddon[] = [
  { id: 'chocolates', name: 'Swiss Artisan Praline Box (8 pcs)', price: 299, icon: 'Cookie' },
  { id: 'candle', name: 'Wild Fig & Vanilla Soy Candle', price: 349, icon: 'Flame' },
  { id: 'plush-bear', name: 'Plush Velvet Keepsake Bear', price: 249, icon: 'Smile' },
  { id: 'plant-food', name: 'Organic Floral Nutrition Elixir', price: 129, icon: 'Droplets' },
];

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: 'classic-floral', name: 'Botanical Blush', style: 'border-rose-300 bg-rose-50/50 text-rose-900' },
  { id: 'modern-minimal', name: 'Minimalist Ivory', style: 'border-stone-300 bg-stone-50 text-stone-800' },
  { id: 'golden-celebration', name: 'Gilded Celebration', style: 'border-amber-300 bg-amber-50/50 text-amber-900' },
  { id: 'soothing-serenity', name: 'Gentle Serenity', style: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'fl-01',
    slug: 'velvet-scarlet-grand-roses',
    name: 'Velvet Scarlet Grand Roses',
    tagline: 'Deep crimson Ecuadorian long-stem roses hand-tied with Italian ruscus',
    price: 1799,
    originalPrice: 2199,
    category: 'romance',
    occasion: ['Romance', 'Anniversary'],
    flowerType: 'Roses',
    stemCount: 18,
    rating: 4.9,
    reviewCount: 142,
    isBestseller: true,
    isNew: false,
    image: '/images/flowers/roses.svg',
    gallery: [
      '/images/flowers/roses.svg',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Symbolizes enduring devotion, heartfelt romance, and timeless elegance.',
    description: 'An iconic tribute to passion. These hand-selected, velvety crimson roses are cut fresh at sunrise from sustainable high-altitude farms. Arranged with fragrant silver dollar eucalyptus and framed in eco-chic tissue and French grosgrain ribbon.',
    careTips: [
      'Trim stems 1 inch at a 45-degree angle under lukewarm running water.',
      'Place in clean vase with cold water and included flower nutrient packet.',
      'Replenish fresh water every 48 hours for up to 10 days of vibrant bloom.'
    ],
    sizes: [
      { name: 'Standard (12 Stems)', price: 1799, multiplier: 1 },
      { name: 'Deluxe (18 Stems)', price: 2399, multiplier: 1.34 },
      { name: 'Grand Luxe (24 Stems)', price: 2999, multiplier: 1.68 }
    ]
  },
  {
    id: 'fl-02',
    slug: 'provence-peach-peonies',
    name: 'Provence Peach Peony Whisper',
    tagline: 'Cloud-soft coral charm peonies paired with garden white ranunculus',
    price: 1999,
    originalPrice: 2499,
    category: 'luxury',
    occasion: ['Birthday', 'Anniversary', 'Congratulations'],
    flowerType: 'Peonies',
    stemCount: 15,
    rating: 5.0,
    reviewCount: 88,
    isBestseller: true,
    isNew: true,
    image: '/images/flowers/peonies.svg',
    gallery: [
      '/images/flowers/peonies.svg',
      'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Represents prosperity, graceful good fortune, and joyful abundance.',
    description: 'A breathtaking cloud of delicate ruffles. As these premium Coral Charm peonies hydrate, they magically transform from rich sunset coral to soft champagne cream, making every single day a new visual delight.',
    careTips: [
      'Remove lower foliage so no leaves sit submerged in water.',
      'Keep away from ripening fruit and drafty AC vents.',
      'Give blooms room to unfurl naturally over 3-4 days.'
    ],
    sizes: [
      { name: 'Standard (10 Peonies + Fillers)', price: 1999, multiplier: 1 },
      { name: 'Deluxe (15 Peonies + Fillers)', price: 2699, multiplier: 1.38 },
      { name: 'Grand Luxe (20 Peonies + Luxe Vase)', price: 3499, multiplier: 1.78 }
    ]
  },
  {
    id: 'fl-03',
    slug: 'sunlit-tuscany-meadow',
    name: 'Sunlit Tuscany Meadow',
    tagline: 'Radiant golden sunflowers, chamomile daisies, and golden solidago',
    price: 1299,
    originalPrice: 1499,
    category: 'birthday',
    occasion: ['Birthday', 'Thank You', 'Just Because'],
    flowerType: 'Sunflowers',
    stemCount: 16,
    rating: 4.8,
    reviewCount: 95,
    isBestseller: false,
    isNew: true,
    image: '/images/flowers/sunflowers.svg',
    gallery: [
      '/images/flowers/sunflowers.svg',
      'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Stands for optimism, warmth, vibrant longevity, and pure happiness.',
    description: 'Pure sunshine delivered right to their doorstep. A joyful countryside harvest arrangement designed to brighten any room, celebrate milestone birthdays, or send an energetic pick-me-up.',
    careTips: [
      'Sunflowers are thirsty blooms! Check water level twice daily.',
      'Display in bright, indirect natural sunlight.',
      'Mist lightly in the mornings for dewy freshness.'
    ],
    sizes: [
      { name: 'Standard Bouquet', price: 1299, multiplier: 1 },
      { name: 'Deluxe (Adds Garden Chamomile & Lilies)', price: 1799, multiplier: 1.39 },
      { name: 'Grand Luxe Feast', price: 2299, multiplier: 1.8 }
    ]
  },
  {
    id: 'fl-04',
    slug: 'celestial-white-lily-symphony',
    name: 'Celestial Lily & Orchid Symphony',
    tagline: 'Fragrant Casablanca oriental lilies, white cymbidium orchids & snapdragons',
    price: 1899,
    originalPrice: 2199,
    category: 'sympathy',
    occasion: ['Sympathy', 'Anniversary', 'Thank You'],
    flowerType: 'Lilies',
    stemCount: 14,
    rating: 4.9,
    reviewCount: 112,
    isBestseller: true,
    isNew: false,
    image: '/images/flowers/lilies.svg',
    gallery: [
      '/images/flowers/lilies.svg',
      'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Stands for serenity, renewed hope, spiritual peace, and gentle comfort.',
    description: 'An ethereal composition of pure white Casablanca lilies radiating sublime fragrance, softened with cascade cymbidium orchids and frosty eucalyptus. Prepared with immense care to offer quiet solace and honor precious memories.',
    careTips: [
      'Gently pluck pollen anthers when buds open to prevent surface staining.',
      'Lilies will steadily unfurl over 7 to 12 days.',
      'Keep away from curious household pets.'
    ],
    sizes: [
      { name: 'Standard Serenity', price: 1899, multiplier: 1 },
      { name: 'Deluxe Majesty', price: 2499, multiplier: 1.33 },
      { name: 'Grand Luxe Memorial Stand', price: 3299, multiplier: 1.75 }
    ]
  },
  {
    id: 'fl-05',
    slug: 'amsterdam-dawn-pastel-tulips',
    name: 'Amsterdam Dawn Pastel Tulips',
    tagline: 'A vibrant kaleidoscope of Dutch fringed, parrot, and double-petal tulips',
    price: 1399,
    originalPrice: 1599,
    category: 'birthday',
    occasion: ['Birthday', 'Congratulations', 'Just Because'],
    flowerType: 'Tulips',
    stemCount: 25,
    rating: 4.7,
    reviewCount: 64,
    isBestseller: false,
    isNew: true,
    image: '/images/flowers/tulips.svg',
    gallery: [
      '/images/flowers/tulips.svg',
      'https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Reflects playful romance, new beginnings, and refreshing spring renewal.',
    description: 'Directly flown in from historic Dutch bulb estates. These multicolored French and fringed tulips continue to playfully grow towards the light in your vase, creating a living work of dynamic art.',
    careTips: [
      'Tulips love ice-cold water! Add a couple of ice cubes daily.',
      'Pin-prick stem just below the bloom to prevent droop.',
      'Stems will grow 1-2 inches inside the vase.'
    ],
    sizes: [
      { name: 'Standard (20 Stems)', price: 1399, multiplier: 1 },
      { name: 'Deluxe (30 Stems)', price: 1799, multiplier: 1.29 },
      { name: 'Grand Luxe (45 Stems)', price: 2399, multiplier: 1.73 }
    ]
  },
  {
    id: 'fl-06',
    slug: 'boho-golden-dune-everlasting',
    name: 'Boho Golden Dune Everlasting',
    tagline: 'Naturally dried pampas plumes, sun-bleached palms & preserved lavender',
    price: 1599,
    originalPrice: 1899,
    category: 'dried',
    occasion: ['Congratulations', 'Thank You', 'Just Because'],
    flowerType: 'Dried Bouquets',
    stemCount: 20,
    rating: 4.9,
    reviewCount: 77,
    isBestseller: true,
    isNew: false,
    image: '/images/flowers/dried.svg',
    gallery: [
      '/images/flowers/dried.svg',
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Celebrates timeless constancy, mindfulness, and enduring aesthetic grace.',
    description: 'No water or maintenance required. Sustainably harvested and preserved blooms that maintain their sculptural texture and earthy elegance for up to 3 years. A design-forward centerpiece for modern interiors.',
    careTips: [
      'Never put in water! Dried florals thrive in dry areas.',
      'Keep away from high humidity like steamy bathrooms.',
      'Lightly blow-dry on cool/low speed once a month to remove dust.'
    ],
    sizes: [
      { name: 'Standard Arrangement', price: 1599, multiplier: 1 },
      { name: 'Deluxe Ceramic Pot Ensemble', price: 2199, multiplier: 1.38 }
    ]
  },
  {
    id: 'fl-07',
    slug: 'royal-magenta-phalaenopsis-orchid',
    name: 'Royal Magenta Phalaenopsis Orchid',
    tagline: 'Living double-spike cascade orchid in a handcrafted textured stone vessel',
    price: 2199,
    originalPrice: 2699,
    category: 'luxury',
    occasion: ['Anniversary', 'Congratulations', 'Thank You'],
    flowerType: 'Orchids',
    stemCount: 2,
    rating: 5.0,
    reviewCount: 53,
    isBestseller: false,
    isNew: true,
    image: '/images/flowers/orchids.svg',
    gallery: [
      '/images/flowers/orchids.svg',
      'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Signifies refined luxury, exquisite beauty, and stately strength.',
    description: 'An architectural living treasure. Two majestic cascading spikes boasting up to 16 velvet-textured jewel-toned blossoms that bloom continuously for over two months.',
    careTips: [
      'Water with 3 ice cubes once every 7-10 days.',
      'Provide filtered, bright morning window light.',
      'Do not allow roots to stand in stagnant drainage water.'
    ],
    sizes: [
      { name: 'Double Stem in Clay Pot', price: 2199, multiplier: 1 },
      { name: 'Triple Stem in Artisanal Vessel', price: 3099, multiplier: 1.41 }
    ]
  },
  {
    id: 'fl-08',
    slug: 'enchanted-english-garden',
    name: 'Enchanted English Garden Romance',
    tagline: 'David Austin garden roses, lilac delphinium, blush sweet peas & herbs',
    price: 2099,
    originalPrice: 2499,
    category: 'romance',
    occasion: ['Romance', 'Birthday', 'Anniversary'],
    flowerType: 'Garden Roses',
    stemCount: 22,
    rating: 4.9,
    reviewCount: 134,
    isBestseller: true,
    isNew: false,
    image: '/images/flowers/garden.svg',
    gallery: [
      '/images/flowers/garden.svg',
      'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=85'
    ],
    symbolism: 'Whispers poetic affection, nostalgia, and enchanting wonder.',
    description: 'Like a freshly plucked stroll through the Cotswolds. Layered with heirloom scented garden roses, cascading cornflower blues, and aromatic spearmint foliage.',
    careTips: [
      'Trim stems recutting every 2 days.',
      'Keep away from direct heat lamps.',
      'Mist gently on warm afternoons.'
    ],
    sizes: [
      { name: 'Standard (16 Stems)', price: 2099, multiplier: 1 },
      { name: 'Deluxe (24 Stems)', price: 2799, multiplier: 1.32 },
      { name: 'Grand Luxe (32 Stems + Vintage Vase)', price: 3799, multiplier: 1.8 }
    ]
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: 'Eleanor Vance',
    location: 'Upper West Side, NY',
    comment: 'The Velvet Scarlet roses arrived on our 10th anniversary in immaculate shape. The personalized letterpress card felt so luxurious. My partner was moved to tears!',
    rating: 5,
    flower: 'Velvet Scarlet Grand Roses',
    verified: true
  },
  {
    id: 2,
    name: 'Marcus Sterling',
    location: 'Austin, TX',
    comment: 'I ordered the Sunlit Tuscany meadow for my mother\'s 60th birthday. The same-day delivery tracked right to her doorstep. She said the flowers were the freshest she had ever received.',
    rating: 5,
    flower: 'Sunlit Tuscany Meadow',
    verified: true
  },
  {
    id: 3,
    name: 'Clara Dubois',
    location: 'San Francisco, CA',
    comment: 'The Coral Peonies changed shades each day just like the florist promised! The vase addon was heavy ceramic and gorgeous. FloraLux is now my go-to boutique.',
    rating: 5,
    flower: 'Provence Peach Peony Whisper',
    verified: true
  }
];

export const FLORIST_PERKS: FloristPerk[] = [
  {
    title: 'Farm-to-Door Freshness',
    description: 'Directly sourced from certified eco-sustainable floral farms within 24 hours of cutting.',
    icon: 'Sparkles'
  },
  {
    title: 'Same-Day & Scheduled Delivery',
    description: 'Guaranteed delivery slots with temperature-controlled courier vans and real-time live SMS updates.',
    icon: 'Truck'
  },
  {
    title: '7-Day Bloom Guarantee',
    description: 'If your blooms do not stay fresh and radiant for a full week, we will replace them complimentary.',
    icon: 'ShieldCheck'
  },
  {
    title: 'Hand-Penned Greeting Card',
    description: 'Every arrangement includes your personal sentiment printed on museum-grade textured paper.',
    icon: 'HeartHandshake'
  }
];
