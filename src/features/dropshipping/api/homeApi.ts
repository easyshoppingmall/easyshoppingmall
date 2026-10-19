import { apiClient } from '../../../api/client';

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

interface ApiHomeBanner {
  _id: string;
  title?: string;
  Description?: string;
  images?: string[];
}

interface ApiNotice {
  _id: string;
  title: string;
  description: string;
  keyPoints?: string[];
  button?: {
    text?: string | null;
    url?: string | null;
  };
  createdAt?: string;
}

interface ApiProduct {
  _id: string;
  productName?: string;
  description?: string;
  brand?: string;
  price?: number | string | null;
  dropshippingPrice?: number | string | null;
  discount?: number | null;
  images?: string[];
  isBoost?: boolean;
  video?: string | string[] | null;
  video_link?: string | null;
  productSize?: string[] | null;
  color?: string[] | null;
  productWeight?: string[] | string | null;
  productStock?: number | string | null;
  sku?: string | null;
  category?: { _id?: string; name?: string }[] | null;
  subCategory?: { _id?: string; name?: string }[] | null;
}

interface ApiCategory {
  _id: string;
  name: string;
  image?: string | null;
  icon?: string | null;
  isActive?: boolean;
}

interface ApiSubcategory {
  _id: string;
  name: string;
  image?: string | null;
  icon?: string | null;
  isActive?: boolean;
  category?: string | { _id?: string; name?: string };
}

interface ApiProductPage {
  success?: boolean;
  message?: string;
  data?: ApiProduct[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
}

export interface DropshippingProfile {
  _id: string;
  name?: string;
  email?: string;
  mobile?: string | number | null;
  image?: string | null;
  role?: string;
  balance?: number | null;
  shopName?: string | null;
}

export interface DropshippingBanner {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface DropshippingNotice {
  id: string;
  title: string;
  description: string;
  keyPoints: string[];
  buttonText?: string;
  createdAt?: string;
}

export interface DropshippingProduct {
  id: string;
  name: string;
  brand?: string;
  price: number;
  dropshippingPrice?: number;
  discount?: number;
  image?: string;
  images?: string[];
  videoUrl?: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  weights?: string[];
  stockCount?: number;
  sku?: string;
  categoryNames?: string[];
  subcategoryNames?: string[];
}

export interface DropshippingCategory {
  id: string;
  name: string;
  image?: string;
  icon?: string;
}

export interface DropshippingSubcategory {
  id: string;
  name: string;
  categoryId: string;
  image?: string;
  icon?: string;
}

export interface DropshippingProductPage {
  products: DropshippingProduct[];
  page: number;
  totalPages: number;
  totalCount: number;
}

export type DropshippingProductType = 'all' | 'new' | 'boost';

export function formatDropshippingTaka(amount: number): string {
  return `৳${formatDropshippingNumber(amount)}`;
}

export function formatDropshippingNumber(amount: number): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const formatted = amount.toLocaleString('en-IN').replace(/\d/g, (digit) => digits[Number(digit)]);
  return formatted;
}

function unwrapList<T>(response: ApiEnvelope<T[]>): T[] {
  if (response.success === false) {
    throw new Error(response.message || 'সার্ভার থেকে তথ্য আনা যায়নি।');
  }
  if (!Array.isArray(response.data)) {
    throw new Error('সার্ভার থেকে তথ্যের সঠিক ফরম্যাট পাওয়া যায়নি।');
  }
  return response.data;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapDropshippingProduct(product: ApiProduct): DropshippingProduct {
  const images = Array.isArray(product.images)
    ? product.images.filter((image) => typeof image === 'string' && image.trim())
    : [];
  const videoValues = [
    product.video_link,
    ...(Array.isArray(product.video) ? product.video : [product.video]),
  ];
  const videoUrl = videoValues.find(
    (video): video is string =>
      typeof video === 'string' && /^https?:\/\//i.test(video.trim())
  );
  const toStringList = (values: string[] | string | null | undefined) =>
    (Array.isArray(values) ? values : typeof values === 'string' ? [values] : [])
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim());

  return {
    id: product._id,
    name: product.productName?.trim() || 'নামহীন পণ্য',
    brand: product.brand?.trim() || undefined,
    price: toOptionalNumber(product.price) ?? 0,
    dropshippingPrice: toOptionalNumber(product.dropshippingPrice),
    discount: toOptionalNumber(product.discount),
    image: images[0],
    images,
    videoUrl: videoUrl?.trim(),
    description: product.description?.trim() || undefined,
    sizes: toStringList(product.productSize),
    colors: toStringList(product.color),
    weights: toStringList(product.productWeight),
    stockCount: toOptionalNumber(product.productStock),
    sku: product.sku?.trim() || undefined,
    categoryNames: product.category?.flatMap((category) =>
      category.name?.trim() ? [category.name.trim()] : []
    ),
    subcategoryNames: product.subCategory?.flatMap((subcategory) =>
      subcategory.name?.trim() ? [subcategory.name.trim()] : []
    ),
  };
}

export async function getDropshippingCategories(
  signal?: AbortSignal
): Promise<DropshippingCategory[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApiCategory[]>>('/api/categories/', { signal });
  return unwrapList(data)
    .filter((category) => category.isActive === true)
    .map((category) => ({
      id: category._id,
      name: category.name,
      image: category.image?.trim() || undefined,
      icon: category.icon?.trim() || undefined,
    }));
}

export async function getDropshippingSubcategories(
  signal?: AbortSignal
): Promise<DropshippingSubcategory[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApiSubcategory[]>>(
    '/api/subcategories/',
    { signal }
  );

  return unwrapList(data).flatMap((subcategory) => {
    if (subcategory.isActive !== true) return [];
    const categoryId =
      typeof subcategory.category === 'string'
        ? subcategory.category
        : subcategory.category?._id;
    if (!categoryId) return [];
    return [{
      id: subcategory._id,
      name: subcategory.name,
      categoryId,
      image: subcategory.image?.trim() || undefined,
      icon: subcategory.icon?.trim() || undefined,
    }];
  });
}

export async function getDropshippingProfile(
  signal?: AbortSignal
): Promise<DropshippingProfile> {
  const { data } = await apiClient.get<{
    success?: boolean;
    message?: string;
    user?: DropshippingProfile;
  }>('/api/users/userprofile', { signal });

  if (data.success === false) {
    throw new Error(data.message || 'অ্যাকাউন্টের তথ্য আনা যায়নি।');
  }
  if (!data.user?._id) {
    throw new Error('সার্ভার থেকে অ্যাকাউন্টের সঠিক তথ্য পাওয়া যায়নি।');
  }
  return data.user;
}

export async function getDropshippingBanners(
  signal?: AbortSignal
): Promise<DropshippingBanner[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApiHomeBanner[]>>(
    '/api/homeBannerRoutes/get',
    { params: { sliderFor: 'DROPSHIPPING', active: true }, signal }
  );

  return unwrapList(data).flatMap((banner) => {
    const image = banner.images?.find((item) => typeof item === 'string' && item.trim());
    return image
      ? [{
          id: banner._id,
          title: banner.title?.trim() ?? '',
          description: banner.Description?.trim() ?? '',
          image,
        }]
      : [];
  });
}

export async function getActiveDropshippingNotices(
  signal?: AbortSignal
): Promise<DropshippingNotice[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApiNotice[]>>(
    '/api/notice/active',
    { signal }
  );

  return unwrapList(data).map((notice) => ({
    id: notice._id,
    title: notice.title,
    description: notice.description,
    keyPoints: Array.isArray(notice.keyPoints)
      ? notice.keyPoints.filter((point) => typeof point === 'string' && point.trim())
      : [],
    buttonText: notice.button?.text || undefined,
    createdAt: notice.createdAt,
  }));
}

export async function getDropshippingProducts(
  type: DropshippingProductType,
  signal?: AbortSignal
): Promise<DropshippingProduct[]> {
  const { data } = await apiClient.post<ApiProductPage>(
    '/api/products/get',
    {
      page: 1,
      limit: 8,
      sortBy: type === 'all' ? 'discount' : 'newest',
      ...(type === 'boost' ? { isBoost: true } : {}),
    },
    { signal }
  );

  if (data.success === false) {
    throw new Error(data.message || 'পণ্য লোড করা যায়নি।');
  }
  if (!Array.isArray(data.data)) {
    throw new Error('সার্ভার থেকে পণ্যের সঠিক তথ্য পাওয়া যায়নি।');
  }

  const uniqueProducts = new Map<string, DropshippingProduct>();
  for (const product of data.data) {
    if (!product._id || uniqueProducts.has(product._id)) continue;
    uniqueProducts.set(product._id, mapDropshippingProduct(product));
  }
  return [...uniqueProducts.values()];
}

export async function searchDropshippingProducts(
  search: string,
  page: number,
  signal?: AbortSignal
): Promise<DropshippingProductPage> {
  const normalizedSearch = search.trim();
  if (normalizedSearch.length < 2) {
    throw new Error('পণ্য খুঁজতে কমপক্ষে ২টি অক্ষর লিখুন।');
  }

  const limit = 12;
  const { data } = await apiClient.post<ApiProductPage>(
    '/api/products/search-product',
    { search: normalizedSearch, page, limit },
    { signal }
  );

  if (data.success === false) {
    throw new Error(data.message || 'পণ্য খোঁজা যায়নি।');
  }
  if (!Array.isArray(data.data)) {
    throw new Error('সার্ভার থেকে পণ্যের সঠিক তথ্য পাওয়া যায়নি।');
  }

  const currentPage = Number(data.page);
  const totalPages = Number(data.totalPages);
  const totalCount = Number(data.totalCount);
  if (
    !Number.isInteger(currentPage) ||
    currentPage !== page ||
    !Number.isInteger(totalPages) ||
    totalPages < 0 ||
    !Number.isFinite(totalCount) ||
    totalCount < 0
  ) {
    throw new Error('সার্ভার থেকে পণ্যের pagination তথ্য পাওয়া যায়নি।');
  }

  const uniqueProducts = new Map<string, DropshippingProduct>();
  for (const product of data.data) {
    if (!product._id || uniqueProducts.has(product._id)) continue;
    uniqueProducts.set(product._id, mapDropshippingProduct(product));
  }

  return {
    products: [...uniqueProducts.values()],
    page: currentPage,
    totalPages,
    totalCount,
  };
}

export async function getDropshippingSubcategoryProducts(
  categoryId: string,
  subcategoryId: string,
  page: number,
  signal?: AbortSignal
): Promise<DropshippingProductPage> {
  if (!categoryId || !subcategoryId) {
    throw new Error('ক্যাটাগরি ও সাবক্যাটাগরি নির্বাচন করুন।');
  }
  const limit = 40;
  const { data } = await apiClient.post<ApiProductPage>(
    '/api/products/get-pruduct-by-category-and-subcategory',
    { categoryId, subCategoryId: subcategoryId, page, limit },
    { signal }
  );

  if (data.success === false) {
    throw new Error(data.message || 'সাবক্যাটাগরির পণ্য লোড করা যায়নি।');
  }
  if (!Array.isArray(data.data)) {
    throw new Error('সার্ভার থেকে পণ্যের সঠিক তথ্য পাওয়া যায়নি।');
  }

  const currentPage = Number(data.page);
  const totalPages = Number(data.totalPages);
  const totalCount = Number(data.totalCount);
  if (
    !Number.isInteger(currentPage) ||
    currentPage !== page ||
    !Number.isInteger(totalPages) ||
    totalPages < 0 ||
    !Number.isFinite(totalCount) ||
    totalCount < 0
  ) {
    throw new Error('সার্ভার থেকে পণ্যের pagination তথ্য পাওয়া যায়নি।');
  }

  const uniqueProducts = new Map<string, DropshippingProduct>();
  for (const product of data.data) {
    if (!product._id || uniqueProducts.has(product._id)) continue;
    uniqueProducts.set(product._id, mapDropshippingProduct(product));
  }
  return { products: [...uniqueProducts.values()], page: currentPage, totalPages, totalCount };
}

export async function getDropshippingProductDetails(
  productId: string,
  signal?: AbortSignal
): Promise<DropshippingProduct & { description?: string }> {
  const { data } = await apiClient.get<ApiEnvelope<ApiProduct>>(
    `/api/products/get-product-details/${encodeURIComponent(productId)}`,
    { signal }
  );
  if (data.success === false || !data.data?._id) {
    throw new Error(data.message || 'পণ্যটি পাওয়া যায়নি।');
  }

  return {
    ...mapDropshippingProduct(data.data),
  };
}
