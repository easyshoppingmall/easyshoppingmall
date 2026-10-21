import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '../../../store/hooks';
import { authApi } from '../../../api/authApi';
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
import { getDropshippingWishlist } from './wishlistApi';
import { getDropshippingOrders } from './profileApi';
import { getDropshippingOrderDetails } from './ordersApi';
import {
  getDropshippingAnalytics,
  getDropshippingPaymentRequests,
} from './workspaceApi';

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
  profileDashboard: (userId: string) =>
    ['dropshipping', 'profile-dashboard', userId] as const,
  wishlist: (userId: string) => ['dropshipping', 'wishlist', userId] as const,
  orders: (userId: string) => ['dropshipping', 'orders', userId] as const,
  orderDetails: (userId: string, orderId: string) =>
    ['dropshipping', 'order-details', userId, orderId] as const,
  analytics: (userId: string) => ['dropshipping', 'analytics', userId] as const,
  paymentRequests: (userId: string) =>
    ['dropshipping', 'payment-requests', userId] as const,
};

export function useDropshippingAnalyticsQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.analytics(userId ?? ''),
    queryFn: ({ signal }) => getDropshippingAnalytics(signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useDropshippingPaymentRequestsQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.paymentRequests(userId ?? ''),
    queryFn: ({ signal }) => getDropshippingPaymentRequests(signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useDropshippingOrdersQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.orders(userId ?? ''),
    queryFn: ({ signal }) => getDropshippingOrders(signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useDropshippingOrderDetailsQuery(orderId: string) {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.orderDetails(userId ?? '', orderId),
    queryFn: ({ signal }) => getDropshippingOrderDetails(orderId, signal),
    enabled: Boolean(userId && orderId),
    staleTime: 30_000,
  });
}

export function useDropshippingProfileQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.profile(userId ?? ''),
    queryFn: ({ signal }) => getDropshippingProfile(signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useDropshippingProfileDashboardQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.profileDashboard(userId ?? ''),
    queryFn: ({ signal }) => authApi.getProfileDashboard(signal),
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

export function useDropshippingWishlistQuery() {
  const userId = useAppSelector((state) => state.auth.user?._id);
  return useQuery({
    queryKey: dropshippingHomeQueryKeys.wishlist(userId ?? ''),
    queryFn: getDropshippingWishlist,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
