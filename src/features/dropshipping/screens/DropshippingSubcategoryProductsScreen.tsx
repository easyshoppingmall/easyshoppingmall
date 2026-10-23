import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { addDropshippingCartItem } from '../../../store/dropshippingCartSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { DropshippingCatalogProductCard } from '../components/DropshippingCatalogProductCard';
import {
  dropshippingHomeQueryKeys,
  useDropshippingSubcategoriesQuery,
  useDropshippingSubcategoryProductsQuery,
  useDropshippingWishlistQuery,
} from '../api/queries';
import {
  addDropshippingWishlistProduct,
  removeDropshippingWishlistProduct,
} from '../api/wishlistApi';
import {
  formatDropshippingNumber,
  type DropshippingProduct,
  type DropshippingProductPage,
} from '../api/homeApi';

const PRODUCT_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 20 };

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function ProductGridSkeleton({ columns }: { columns: number }) {
  return (
    <View className="flex-row flex-wrap justify-between px-4 pt-4">
      {Array.from({ length: columns * 3 }, (_, index) => (
        <View key={index} className="mb-3 overflow-hidden rounded-2xl border border-line bg-white" style={{ width: `${100 / columns - 2}%` }}>
          <View className="h-[150px] bg-slate-200" />
          <View className="p-3">
            <View className="h-3 w-4/5 rounded bg-slate-200" />
            <View className="mt-2 h-3 w-2/5 rounded bg-slate-200" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DropshippingSubcategoryProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subcategory?: string | string[];
    categoryId?: string | string[];
    name?: string | string[];
  }>();
  const subcategoryId = firstParam(params.subcategory);
  const routeCategoryId = firstParam(params.categoryId);
  const routeName = firstParam(params.name);
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const subcategoriesQuery = useDropshippingSubcategoriesQuery();
  const wishlistQuery = useDropshippingWishlistQuery();
  const subcategory = subcategoriesQuery.data?.find((item) => item.id === subcategoryId);
  const categoryId = routeCategoryId || subcategory?.categoryId || '';
  const title = routeName || subcategory?.name || 'সাবক্যাটাগরির পণ্য';
  const [pagination, setPagination] = useState({ subcategoryId: '', page: 1 });
  const [visibleProductIds, setVisibleProductIds] = useState<Set<string>>(() => new Set());
  const page = pagination.subcategoryId === subcategoryId ? pagination.page : 1;
  const listRef = useRef<FlatList<DropshippingProduct>>(null);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<DropshippingProduct>[] }) => {
      const visibleIds = new Set(viewableItems.map(({ item }) => item.id));
      setVisibleProductIds((current) =>
        current.size === visibleIds.size && [...current].every((id) => visibleIds.has(id))
          ? current
          : visibleIds
      );
    },
    []
  );
  const productsQuery = useDropshippingSubcategoryProductsQuery(categoryId, subcategoryId, page);
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(screenWidth - 32, 0), 1120);
  const columns = contentWidth >= 900 ? 5 : contentWidth >= 560 ? 3 : 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const products = productsQuery.data?.products ?? [];
  const wishlistMutation = useMutation({
    mutationFn: ({ productId, add }: { productId: string; add: boolean }) =>
      add
        ? addDropshippingWishlistProduct(productId)
        : removeDropshippingWishlistProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dropshippingHomeQueryKeys.wishlist(userId ?? ''),
      });
    },
    onError: (error) => {
      Alert.alert(
        'উইশলিস্ট আপডেট হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
  });
  const previousPageData = page > 1
    ? queryClient.getQueryData<DropshippingProductPage>(
        dropshippingHomeQueryKeys.subcategoryProducts(categoryId, subcategoryId, page - 1)
      )
    : undefined;
  const totalPages = productsQuery.data?.totalPages ?? previousPageData?.totalPages ?? 0;
  const changePage = (nextPage: number) => {
    setPagination({ subcategoryId, page: nextPage });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const checkoutProduct = (product: DropshippingProduct) => {
    const hasVariants = Boolean(
      product.sizes?.length || product.colors?.length || product.weights?.length
    );
    if (hasVariants) {
      router.push({
        pathname: '/(dropshipping)/product/[id]',
        params: { id: product.id },
      });
      return;
    }
    dispatch(addDropshippingCartItem({
      product,
      size: '',
      color: '',
      weight: '',
    }));
    router.push('/(dropshipping)/cart');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="সব পণ্যে ফিরুন"
          onPress={() => router.replace('/(dropshipping)/all-products')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-[15px] font-extrabold text-ink">{title}</Text>
          <Text className="mt-0.5 text-[10px] text-muted">ড্রপশিপিং পণ্য</Text>
        </View>
        {productsQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {!categoryId && subcategoriesQuery.isPending ? (
        <ProductGridSkeleton columns={columns} />
      ) : !categoryId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={34} color={colors.accent} />
          <Text className="mt-3 text-center text-[13px] font-bold text-ink">
            সাবক্যাটাগরিটি খুঁজে পাওয়া যায়নি
          </Text>
          <Pressable
            onPress={() => router.replace('/(dropshipping)/all-products')}
            className="mt-4 rounded-xl bg-primary px-5 py-3"
          >
            <Text className="text-[11px] font-bold text-white">সব ক্যাটাগরি দেখুন</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            key={`product-grid-${columns}`}
            style={{ flex: 1 }}
            data={productsQuery.isPending || productsQuery.isError ? [] : products}
            numColumns={columns}
            initialNumToRender={columns * 2}
            maxToRenderPerBatch={columns * 2}
            windowSize={5}
            extraData={visibleProductIds}
            viewabilityConfig={PRODUCT_VIEWABILITY_CONFIG}
            onViewableItemsChanged={onViewableItemsChanged}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              width: contentWidth,
              alignSelf: 'center',
              paddingTop: 16,
              paddingBottom: 20,
              flexGrow: 1,
            }}
            columnWrapperStyle={columns > 1 ? { gap } : undefined}
            refreshControl={
              <RefreshControl
                refreshing={productsQuery.isRefetching}
                onRefresh={() => void productsQuery.refetch()}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              productsQuery.data ? (
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold text-ink">
                    {formatDropshippingNumber(productsQuery.data.totalCount)}টি পণ্য
                  </Text>
                  <Text className="text-[10px] text-muted">
                    পৃষ্ঠা {formatDropshippingNumber(productsQuery.data.page)} / {formatDropshippingNumber(totalPages)}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={{ width: cardWidth, marginBottom: gap }}>
                <DropshippingCatalogProductCard
                  product={item}
                  checkoutDisabled={item.stockCount === 0}
                  onCheckout={() => checkoutProduct(item)}
                  isWishlisted={wishlistQuery.data?.some((saved) => saved.id === item.id) ?? false}
                  onToggleWishlist={() =>
                    wishlistMutation.mutate({
                      productId: item.id,
                      add: !(wishlistQuery.data?.some((saved) => saved.id === item.id) ?? false),
                    })
                  }
                  wishlistDisabled={
                    wishlistQuery.isPending ||
                    (wishlistMutation.isPending && wishlistMutation.variables?.productId === item.id)
                  }
                  wishlistPending={
                    wishlistMutation.isPending && wishlistMutation.variables?.productId === item.id
                  }
                  isVisible={visibleProductIds.has(item.id)}
                  onPress={() =>
                    router.push({
                      pathname: '/(dropshipping)/product/[id]',
                      params: { id: item.id },
                    })
                  }
                />
              </View>
            )}
            ListEmptyComponent={
              productsQuery.isPending ? (
                <ProductGridSkeleton columns={columns} />
              ) : productsQuery.isError ? (
                <View className="flex-1 items-center justify-center px-6 py-16">
                  <Ionicons name="cloud-offline-outline" size={34} color="#DC2626" />
                  <Text className="mt-3 text-center text-[13px] font-bold text-ink">
                    {productsQuery.error.message || 'পণ্য লোড করা যায়নি'}
                  </Text>
                  <Pressable
                    onPress={() => void productsQuery.refetch()}
                    className="mt-4 rounded-xl bg-primary px-5 py-3"
                  >
                    <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-1 items-center justify-center px-6 py-16">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white">
                    <Ionicons name="file-tray-outline" size={30} color={colors.muted} />
                  </View>
                  <Text className="mt-3 text-[14px] font-bold text-ink">এখন কোনো পণ্য নেই</Text>
                  <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
                    এই সাবক্যাটাগরিতে পরে নতুন পণ্য যোগ হলে এখানে দেখাবে।
                  </Text>
                </View>
              )
            }
          />
          {totalPages > 1 ? (
            <View className="flex-row items-center justify-between border-t border-line bg-white px-4 py-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="আগের ৪০টি পণ্য"
                disabled={page <= 1 || productsQuery.isFetching}
                onPress={() => changePage(Math.max(1, page - 1))}
                className={`h-10 flex-row items-center rounded-xl border border-line px-3 ${page <= 1 || productsQuery.isFetching ? 'opacity-40' : ''}`}
              >
                <Ionicons name="chevron-back" size={17} color={colors.ink} />
                <Text className="ml-1 text-[11px] font-semibold text-ink">আগের</Text>
              </Pressable>
              <View className="items-center">
                <Text className="text-[11px] font-bold text-ink">
                  {formatDropshippingNumber(page)} / {formatDropshippingNumber(totalPages)}
                </Text>
                <Text className="mt-0.5 text-[9px] text-muted">প্রতি পৃষ্ঠায় ৪০টি</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="পরের ৪০টি পণ্য"
                disabled={page >= totalPages || productsQuery.isFetching}
                onPress={() => changePage(Math.min(totalPages, page + 1))}
                className={`h-10 flex-row items-center rounded-xl bg-primary px-3 ${page >= totalPages || productsQuery.isFetching ? 'opacity-40' : ''}`}
              >
                <Text className="mr-1 text-[11px] font-semibold text-white">পরের</Text>
                <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

export default DropshippingSubcategoryProductsScreen;
