export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface FlowerSize {
  name: string;
  price: number;
  multiplier: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice: number;
  category: string;
  occasion: string[];
  flowerType: string;
  stemCount: number;
  rating: number;
  reviewCount: number;
  isBestseller: boolean;
  isNew: boolean;
  image: string;
  gallery: string[];
  symbolism: string;
  description: string;
  careTips: string[];
  sizes: FlowerSize[];
}

export interface VaseOption {
  id: string;
  name: string;
  price: number;
  image: string;
}

export interface GiftAddon {
  id: string;
  name: string;
  price: number;
  icon: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  style: string;
}

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  cartItemId: number;
  selectedSize?: FlowerSize;
  selectedVase?: VaseOption;
  addons?: GiftAddon[];
  cardMessage?: string;
  cardSender?: string;
  cardTemplate?: string;
  deliveryDate?: string;
  deliverySlot?: string;
}

export interface RecipientInfo {
  fullName: string;
  phone: string;
  address: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

export interface SenderInfo {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  keepSecret: boolean;
}

export interface Order {
  id: string;
  date: string;
  status: string;
  currentStep: number;
  estimatedDelivery: string;
  slot: string;
  subtotal?: number;
  discountAmount?: number;
  shippingFee?: number;
  total: number;
  driver?: {
    name: string;
    van: string;
    temp: string;
  };
  recipient: RecipientInfo;
  sender: SenderInfo;
  cardMessage?: string;
  items: CartItem[];
  trackingToken?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface Testimonial {
  id: number;
  name: string;
  location: string;
  comment: string;
  rating: number;
  flower: string;
  verified: boolean;
}

export interface FloristPerk {
  title: string;
  description: string;
  icon: string;
}
