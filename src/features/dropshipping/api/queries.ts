import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '../../../store/hooks';
import {
  getActiveDropshippingNotices,
  getDropshippingBanners,
  getDropshippingCategories,
  getDropshippingProductDetails,
  getDropshippingProducts,
  getDropshippingProfile,
  getDropshippingSubcategories,
  getDropshippingSubcategoryProducts,
  searchDropshippingProducts,
  type DropshippingProductType,
} from './homeApi';

export const dropshippingHomeQueryKeys = {
  profile: (userId: string) => ['dropshipping', 'profile', userId] as const,
  banners: ['dropshipping', 'home', 'banners'] as const,
  notices: ['dropshipping', 'home', 'notices'] as const,
  products: (type: DropshippingProductType) =>
    ['dropshipping', 'home', 'products', type] as const,
  searchProducts: (search: string, page: number) =>
    ['dropshipping', 'products', 'search', search, page] as const,
  categories: ['dropshipping', 'catalog', 'categories'] as const,
  subcategories: ['dropshipping', 'catalog', 'subcategories'] as const,
  subcategoryProducts: (categoryId: string, subcategoryId: string, page: number) =>
    ['dropshipping', 'catalog', 'products', categoryId, subcategoryId, page] as const,
  productDetails: (productId: string) =>
    ['dropshipping', 'product-details', productId] as const,
};

export function useDropshippingProfileQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.profile(userId ?? ''),
    queryFn: ({ signal }) => getDropshippingProfile(signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useDropshippingBannersQuery() {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.banners,
    queryFn: ({ signal }) => getDropshippingBanners(signal),
    staleTime: 5 * 60_000,
  });
}

export function useActiveDropshippingNoticesQuery() {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.notices,
    queryFn: ({ signal }) => getActiveDropshippingNotices(signal),
    staleTime: 5 * 60_000,
  });
}

export function useDropshippingProductsQuery(type: DropshippingProductType) {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.products(type),
    queryFn: ({ signal }) => getDropshippingProducts(type, signal),
    staleTime: 60_000,
  });
}

export function useSearchDropshippingProductsQuery(search: string, page: number) {
  const normalizedSearch = search.trim();
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.searchProducts(normalizedSearch, page),
    queryFn: ({ signal }) => searchDropshippingProducts(normalizedSearch, page, signal),
    enabled: normalizedSearch.length >= 2,
    staleTime: 60_000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[0] === 'dropshipping' &&
      previousQuery.queryKey[1] === 'products' &&
      previousQuery.queryKey[2] === 'search' &&
      previousQuery.queryKey[3] === normalizedSearch
        ? previousData
        : undefined,
  });
}

export function useDropshippingCategoriesQuery() {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.categories,
    queryFn: ({ signal }) => getDropshippingCategories(signal),
    staleTime: 5 * 60_000,
  });
}

export function useDropshippingSubcategoriesQuery() {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.subcategories,
    queryFn: ({ signal }) => getDropshippingSubcategories(signal),
    staleTime: 5 * 60_000,
  });
}

export function useDropshippingSubcategoryProductsQuery(
  categoryId: string,
  subcategoryId: string,
  page: number
) {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.subcategoryProducts(categoryId, subcategoryId, page),
    queryFn: ({ signal }) =>
      getDropshippingSubcategoryProducts(categoryId, subcategoryId, page, signal),
    enabled: Boolean(categoryId && subcategoryId),
    staleTime: 60_000,
  });
}

export function useDropshippingProductDetailsQuery(productId: string) {
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.productDetails(productId),
    queryFn: ({ signal }) => getDropshippingProductDetails(productId, signal),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}
