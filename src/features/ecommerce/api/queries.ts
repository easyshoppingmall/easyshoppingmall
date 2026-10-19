import { useQuery } from '@tanstack/react-query';
import {
  getHomeCategories,
  getHomeSubcategories,
  getProductsPage,
} from './homeApi';

export const SHOP_PAGE_SIZE = 50;

export const catalogQueryKeys = {
  categories: ['catalog', 'categories'] as const,
  subcategories: ['catalog', 'subcategories'] as const,
  products: (filters: ShopProductFilters, page: number) => [
    'catalog',
    'products',
    filters.categoryId ?? '',
    filters.subCategoryId ?? '',
    filters.search?.trim() ?? '',
    filters.subCategoryId ? '' : filters.sortBy,
    page,
  ] as const,
};

export interface ShopProductFilters {
  categoryId?: string;
  subCategoryId?: string;
  search?: string;
  sortBy: string;
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.categories,
    queryFn: getHomeCategories,
  });
}

export function useSubcategoriesQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.subcategories,
    queryFn: getHomeSubcategories,
  });
}

export function useShopProductsQuery(
  filters: ShopProductFilters,
  page: number,
  enabled = true
) {
  return useQuery({
    queryKey: catalogQueryKeys.products(filters, page),
    queryFn: ({ signal }) =>
      getProductsPage({
        ...filters,
        page,
        limit: SHOP_PAGE_SIZE,
        sortBy: filters.subCategoryId ? undefined : filters.sortBy,
        signal,
      }),
    staleTime: 1000 * 60,
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey;
      const currentKey = catalogQueryKeys.products(filters, page);
      const sameFilters =
        previousKey?.[0] === currentKey[0] &&
        previousKey?.[1] === currentKey[1] &&
        previousKey?.[2] === currentKey[2] &&
        previousKey?.[3] === currentKey[3] &&
        previousKey?.[4] === currentKey[4] &&
        previousKey?.[5] === currentKey[5];
      return sameFilters ? previousData : undefined;
    },
    enabled,
  });
}
