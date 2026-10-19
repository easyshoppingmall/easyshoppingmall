export interface ProductColor {
  name: string;
  colorCode: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  bgColor: string;
  image?: string;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  discountPercent?: number;
  image: string;
  bgColor: string;
  category: string;
  rating?: number;
  reviewsCount?: number;
  stockCount?: number;
  isVerified?: boolean;
  sizes?: string[];
  colors?: ProductColor[];
  subcategories?: string[];
  gallery?: string[];
  description?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  badge?: string;
  icon?: string;
  image?: string;
  bgGradient: [string, string];
}

export interface Benefit {
  id: string;
  icon: string;
  title: string;
  description?: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const isRemoteImage = (value: string | undefined): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

export const BENEFITS: Benefit[] = [
  { id: 'b1', icon: '🚚', title: 'দ্রুত ডেলিভারি', description: 'সারা দেশে ২-৩ দিনে' },
  { id: 'b2', icon: '✅', title: 'আসল পণ্য', description: '১০০% অরিজিনাল কোয়ালিটি' },
  { id: 'b3', icon: '↩️', title: 'সহজ রিটার্ন', description: '৭ দিনের মধ্যে ফেরতযোগ্য' },
];

export const toBengaliNumber = (num: number | string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .replace(/\d/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
};

export const formatTaka = (amount: number): string => {
  const formattedWithCommas = amount.toLocaleString('en-IN');
  return `৳${toBengaliNumber(formattedWithCommas)}`;
};

export function matchesProductSearch(product: Product, search: string): boolean {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  return [
    product.name,
    product.subtitle,
    product.description,
    product.category,
    ...(product.subcategories ?? []),
  ].some((value) => value?.toLocaleLowerCase().includes(term));
}

export function sortProducts(products: Product[], sortBy: string): Product[] {
  const sorted = [...products];
  if (sortBy === 'discount') {
    sorted.sort((left, right) => (right.discountPercent ?? 0) - (left.discountPercent ?? 0));
  } else if (sortBy === 'price-low') {
    sorted.sort((left, right) => left.price - right.price);
  } else if (sortBy === 'price-high') {
    sorted.sort((left, right) => right.price - left.price);
  } else if (sortBy === 'rating') {
    sorted.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));
  }
  return sorted;
}
