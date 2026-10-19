import { apiClient } from '../../../api/client';
import {
  toBengaliNumber,
  type Banner,
  type Category,
  type Product,
  type Subcategory,
  sortProducts,
} from '../data/catalog';

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

interface ApiCategory {
  _id: string;
  name: string;
  image?: string | null;
  icon?: string | null;
}

interface ApiSubcategory {
  _id: string;
  name: string;
  image?: string | null;
  icon?: string | null;
  category?: string | { _id: string; name?: string };
}

interface ApiBanner {
  _id: string;
  title?: string;
  Description?: string;
  images?: string[];
  status?: string;
}

interface ApiHomeBanner {
  _id: string;
  images?: string[];
  sliderFor?: string;
  active?: boolean;
}

interface ApiProduct {
  _id: string;
  productName?: string;
  description?: string;
  brand?: string;
  price?: number | null;
  productStock?: number | null;
  discount?: number | null;
  ratings?: number | null;
  reviewsCount?: number | null;
  images?: string[];
  productSize?: string[];
  color?: string[];
  category?: { _id?: string; name?: string }[];
  subCategory?: { _id?: string; name?: string }[];
}

interface ApiProductList {
  data?: ApiProduct[];
  success?: boolean;
  message?: string;
  totalCount?: number;
  page?: number;
  totalPages?: number;
}

export interface SubcategoryProducts {
  id: string;
  name: string;
  categoryId: string;
  image?: string;
  products: Product[];
}

export interface SubcategoryProductsResult {
  sections: SubcategoryProducts[];
  errors: string[];
}

export interface ProductPage {
  products: Product[];
  page: number;
  totalPages: number;
  totalCount?: number;
}

async function getList<T>(path: string): Promise<T[]> {
  const { data } = await apiClient.get<ApiEnvelope<T[]>>(path);
  if (data.success === false) {
    throw new Error(data.message || 'সার্ভার থেকে তথ্য আনা যায়নি');
  }
  if (!Array.isArray(data.data)) {
    throw new Error('সার্ভার থেকে তথ্যের সঠিক ফরম্যাট পাওয়া যায়নি');
  }
  return data.data;
}

export function mapApiProduct(product: ApiProduct): Product {
  const price = Number(product.price) || 0;
  const discountPercent = Math.min(99, Math.max(0, Number(product.discount) || 0));
  const images = Array.isArray(product.images)
    ? product.images.filter((image) => typeof image === 'string' && image.trim())
    : [];
  const category = Array.isArray(product.category) ? product.category[0]?.name : undefined;

  return {
    id: product._id,
    name: product.productName?.trim() || 'নামহীন পণ্য',
    subtitle: product.brand || undefined,
    price,
    originalPrice:
      discountPercent > 0 && price > 0
        ? Math.round(price / (1 - discountPercent / 100))
        : undefined,
    discount: discountPercent > 0 ? `${toBengaliNumber(discountPercent)}% ছাড়` : undefined,
    discountPercent,
    image: images[0] || '🛍️',
    gallery: images,
    bgColor: '#E5F4FD',
    category: category || 'অন্যান্য',
    subcategories: Array.isArray(product.subCategory)
      ? product.subCategory.flatMap((subcategory) =>
          subcategory.name ? [subcategory.name] : []
        )
      : undefined,
    rating: Number(product.ratings) || undefined,
    stockCount: product.productStock ?? undefined,
    reviewsCount: Number(product.reviewsCount) || undefined,
    sizes: product.productSize?.length ? product.productSize : undefined,
    colors: product.color?.length
      ? product.color.map((color) => ({ name: color, colorCode: '#CBD5E1' }))
      : undefined,
    description: product.description,
  };
}

export async function getHomeCategories(): Promise<Category[]> {
  const categories = await getList<ApiCategory>('/api/categories/');
  return categories.map((category, index) => ({
    id: category._id,
    name: category.name,
    icon: category.icon || '🛍️',
    image: category.image || undefined,
    bgColor: ['#E5F4FD', '#FFF1E0', '#EAF7EE', '#FDECEF', '#F3EBFB'][index % 5],
  }));
}

export async function getHomeSubcategories(): Promise<Subcategory[]> {
  const subcategories = await getList<ApiSubcategory>('/api/subcategories/');
  return subcategories.flatMap((subcategory) => {
    const categoryId =
      typeof subcategory.category === 'string'
        ? subcategory.category
        : subcategory.category?._id;
    if (!categoryId) return [];
    return [{
      id: subcategory._id,
      name: subcategory.name,
      categoryId,
      image: subcategory.image || undefined,
    }];
  });
}

export async function getTopHomeBanners(): Promise<Banner[]> {
  const banners = await getList<ApiHomeBanner>(
    '/api/homeBannerRoutes/get?sliderFor=USER&active=true'
  );
  return banners.flatMap((banner, index) => {
    const image = banner.images?.find((item) => typeof item === 'string' && item.trim());
    if (!image) return [];
    return [{
      id: banner._id,
      title: '',
      subtitle: '',
      buttonText: '',
      image,
      bgGradient: index % 2 === 0 ? ['#E5F4FD', '#F7FAFC'] : ['#F3EBFB', '#F7FAFC'],
    }];
  });
}

export async function getCenterBanners(): Promise<Banner[]> {
  const banners = await getList<ApiBanner>('/api/CenterBanner/get?status=active');
  return banners
    .filter((banner) => banner.images?.some((image) => typeof image === 'string' && image.trim()))
    .map((banner, index) => ({
      id: banner._id,
      title: '',
      subtitle: '',
      buttonText: '',
      image: banner.images?.find((image) => typeof image === 'string' && image.trim()),
      bgGradient: index % 2 === 0 ? ['#0092EE', '#0067B3'] : ['#7C3AED', '#4F46E5'],
    }));
}

export async function getProductsPage(options: {
  page: number;
  limit: number;
  categoryId?: string;
  subCategoryId?: string;
  search?: string;
  sortBy?: string;
  signal?: AbortSignal;
}): Promise<ProductPage> {
  if (options.subCategoryId && !options.categoryId) {
    throw new Error('সাব-ক্যাটাগরি পণ্যের জন্য ক্যাটাগরি আইডি প্রয়োজন');
  }
  const hasSubcategory = Boolean(options.categoryId && options.subCategoryId);
  const hasSearch = Boolean(options.search?.trim());
  const path = hasSubcategory
    ? '/api/products/get-pruduct-by-category-and-subcategory'
    : hasSearch
      ? '/api/products/search-product'
      : '/api/products/get';
  const { data } = await apiClient.post<ApiProductList>(path, {
    page: options.page,
    limit: options.limit,
    ...(options.sortBy ? { sortBy: options.sortBy } : {}),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.subCategoryId ? { subCategoryId: options.subCategoryId } : {}),
    ...(hasSearch && !hasSubcategory ? { search: options.search?.trim() } : {}),
  }, { signal: options.signal });

  if (data.success === false) {
    throw new Error(data.message || 'পণ্য লোড করা যায়নি');
  }
  if (!Array.isArray(data.data)) {
    throw new Error('সার্ভার থেকে পণ্যের সঠিক তথ্য পাওয়া যায়নি');
  }
  if (data.data.length > options.limit) {
    throw new Error('সার্ভার অনুরোধের চেয়ে বেশি পণ্য পাঠিয়েছে');
  }

  const page = Number(data.page);
  const totalPages = Number(data.totalPages);
  const totalCount = Number(data.totalCount);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page !== options.page ||
    !Number.isInteger(totalPages) ||
    totalPages < 0 ||
    !Number.isFinite(totalCount) ||
    totalCount < 0
  ) {
    throw new Error('সার্ভার থেকে পণ্যের pagination তথ্য পাওয়া যায়নি');
  }

  const uniqueProducts = new Map<string, ApiProduct>();
  for (const product of data.data) {
    if (!uniqueProducts.has(product._id)) uniqueProducts.set(product._id, product);
  }
  const products = [...uniqueProducts.values()].map(mapApiProduct);
  return {
    products: hasSearch || hasSubcategory
      ? sortProducts(products, options.sortBy ?? 'discount')
      : products,
    page,
    totalPages,
    totalCount,
  };
}

export async function getImageSearchProducts(imageUri: string): Promise<Product[]> {
  const form = new FormData() as FormData & {
    append(name: string, value: { uri: string; name: string; type: string }): void;
  };
  form.append('image', {
    uri: imageUri,
    name: 'product-search.jpg',
    type: 'image/jpeg',
  });
  const { data } = await apiClient.post<ApiProductList>('/api/products/image-search', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (data.success === false) throw new Error(data.message || 'ছবি দিয়ে পণ্য খোঁজা যায়নি');
  if (!Array.isArray(data.data)) throw new Error('সার্ভার থেকে পণ্যের সঠিক তথ্য পাওয়া যায়নি');
  return data.data.map(mapApiProduct);
}

export async function getPopularProducts(options: {
  page: number;
  limit: number;
}): Promise<ProductPage> {
  const { data } = await apiClient.post<
    ApiEnvelope<{ products?: ApiProduct[]; totalPages?: number; page?: number }>
  >('/api/homepage/popular-products', options);
  if (data.success === false) {
    throw new Error(data.message || 'জনপ্রিয় পণ্য লোড করা যায়নি');
  }
  const products = data.data?.products;
  if (!Array.isArray(products)) {
    throw new Error('সার্ভার থেকে জনপ্রিয় পণ্যের সঠিক তথ্য পাওয়া যায়নি');
  }
  return {
    products: products.map(mapApiProduct),
    page: Number(data.data?.page) || options.page,
    totalPages: Number(data.data?.totalPages) || 1,
  };
}

export async function getHomeProducts(options: {
  limit: number;
  categoryId?: string;
  subCategoryId?: string;
}): Promise<Product[]> {
  const { products } = await getProductsPage({
    ...options,
    page: 1,
    sortBy: 'discount',
  });
  return products;
}

export async function getProductsForSubcategories(
  subcategories: Subcategory[]
): Promise<SubcategoryProductsResult> {
  const sections: SubcategoryProducts[] = [];
  const errors: string[] = [];
  const batchSize = 4;

  for (let index = 0; index < subcategories.length; index += batchSize) {
    const batch = subcategories.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (subcategory) => {
        try {
          const products = await getHomeProducts({
            limit: 10,
            categoryId: subcategory.categoryId,
            subCategoryId: subcategory.id,
          });
          return {
            failed: false as const,
            section: { ...subcategory, products },
          };
        } catch (error) {
          return {
            failed: true as const,
            message: `${subcategory.name}: ${
              error instanceof Error ? error.message : 'পণ্য লোড করা যায়নি'
            }`,
          };
        }
      })
    );

    for (const result of results) {
      if (result.failed) errors.push(result.message);
      else if (result.section.products.length > 0) sections.push(result.section);
    }
  }

  return { sections, errors };
}

export async function getProductById(id: string): Promise<Product> {
  const { data } = await apiClient.get<ApiEnvelope<ApiProduct>>(
    `/api/products/get-product-details/${encodeURIComponent(id)}`
  );

  if (data.success === false || !data.data) {
    throw new Error(data.message || 'পণ্যটি পাওয়া যায়নি');
  }

  return mapApiProduct(data.data);
}
