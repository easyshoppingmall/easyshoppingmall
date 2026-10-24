import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { addDropshippingCartItem } from '../../../store/dropshippingCartSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { DropshippingCatalogProductCard } from '../components/DropshippingCatalogProductCard';
import {
  dropshippingHomeQueryKeys,
  useDropshippingProductsQuery,
  useDropshippingWishlistQuery,
} from '../api/queries';
import {
  DROPSHIPPING_NEW_PRODUCT_CUTOFF,
  type DropshippingProduct,
  type DropshippingProductType,
} from '../api/homeApi';
import {
  addDropshippingWishlistProduct,
  removeDropshippingWishlistProduct,
} from '../api/wishlistApi';
import { formatDropshippingNumber } from '../api/homeApi';

const PRODUCT_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 20 };

function ProductGridSkeleton({ columns }: { columns: number }) {
  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: columns * 3 }, (_, index) => (
        <View
          key={index}
          className="mb-3 overflow-hidden rounded-2xl border border-line bg-white"
          style={{ width: `${100 / columns - 2}%` }}
        >
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

export function DropshippingFeaturedProductsScreen({
  type,
}: {
  type: Extract<DropshippingProductType, 'new' | 'boost'>;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const productsQuery = useDropshippingProductsQuery(type);
  const wishlistQuery = useDropshippingWishlistQuery();
  const [visibleProductIds, setVisibleProductIds] = useState<Set<string>>(() => new Set());
  const listRef = useRef<FlatList<DropshippingProduct> | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(screenWidth - 32, 0), 1120);
  const columns = contentWidth >= 900 ? 5 : contentWidth >= 560 ? 3 : 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const products = useMemo(() => {
    const fetchedProducts = productsQuery.data?.pages.flatMap((page) => page.products) ?? [];
    if (type === 'boost') return fetchedProducts.filter((product) => product.isBoost === true);
    return fetchedProducts.filter((product) => {
      if (!product.createdAt) return false;
      const createdAt = new Date(product.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= DROPSHIPPING_NEW_PRODUCT_CUTOFF;
    });
  }, [productsQuery.data, type]);
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
    dispatch(addDropshippingCartItem({ product, size: '', color: '', weight: '' }));
    router.push('/(dropshipping)/cart');
  };
  const title = type === 'boost' ? 'Boost Products' : 'New Products';
  const subtitle = type === 'boost'
    ? 'Boost হিসেবে চিহ্নিত পণ্যগুলো'
    : 'গত ৩০ দিনের মধ্যে যোগ করা নতুন পণ্য';
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-ink">{title}</Text>
          <Text className="mt-0.5 text-[10px] text-muted">{subtitle}</Text>
        </View>
        {productsQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <FlatList
        ref={listRef}
        key={`featured-products-${columns}`}
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
          paddingBottom: 24,
          flexGrow: 1,
        }}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        onEndReached={() => {
          if (productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
            void productsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isRefetching && !productsQuery.isFetchingNextPage}
            onRefresh={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
              void productsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="mb-4 overflow-hidden rounded-2xl bg-primary px-4 py-4">
            <Text className="text-[15px] font-extrabold text-white">{title}</Text>
            <Text className="mt-1 text-[10px] leading-4 text-white/85">{subtitle}</Text>
            {products.length ? (
              <Text className="mt-2 text-[9px] font-semibold text-white/85">
                {formatDropshippingNumber(products.length)}টি পণ্য লোড হয়েছে
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isWishlisted = wishlistQuery.data?.some((saved) => saved.id === item.id) ?? false;
          return (
            <View style={{ width: cardWidth, marginBottom: gap }}>
              <View
                className={`mb-1.5 flex-row items-center self-start rounded-full px-2 py-1 ${
                  type === 'boost' ? 'bg-tint-purple' : 'bg-tint-orange'
                }`}
              >
                <Ionicons
                  name={type === 'boost' ? 'rocket-outline' : 'sparkles-outline'}
                  size={11}
                  color={type === 'boost' ? '#6941C6' : '#B54708'}
                />
                <Text
                  className={`ml-1 text-[8px] font-extrabold ${
                    type === 'boost' ? 'text-[#6941C6]' : 'text-[#B54708]'
                  }`}
                >
                  {type === 'boost' ? 'BOOST PRODUCT' : 'নতুন পণ্য'}
                </Text>
              </View>
              <DropshippingCatalogProductCard
                product={item}
                checkoutDisabled={item.stockCount === 0}
                onCheckout={() => checkoutProduct(item)}
                isWishlisted={isWishlisted}
                onToggleWishlist={() =>
                  wishlistMutation.mutate({ productId: item.id, add: !isWishlisted })
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
          );
        }}
        ListEmptyComponent={
          productsQuery.isPending ? (
            <ProductGridSkeleton columns={columns} />
          ) : productsQuery.isError ? (
            <View className="items-center px-6 py-16">
              <Ionicons name="cloud-offline-outline" size={34} color={colors.accent} />
              <Text className="mt-3 text-center text-[12px] font-bold text-ink">
                {productsQuery.error instanceof Error
                  ? productsQuery.error.message
                  : 'পণ্য লোড করা যায়নি।'}
              </Text>
              <Pressable
                onPress={() => void productsQuery.refetch()}
                className="mt-4 rounded-xl bg-primary px-5 py-3"
              >
                <Text className="text-[10px] font-bold text-white">আবার চেষ্টা করুন</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center rounded-2xl border border-dashed border-line bg-white px-5 py-9">
              <Ionicons
                name={type === 'boost' ? 'rocket-outline' : 'sparkles-outline'}
                size={30}
                color={colors.muted}
              />
              <Text className="mt-3 text-center text-[12px] font-bold text-ink">
                {type === 'boost'
                  ? 'এখন কোনো Boost Product নেই'
                  : 'গত ৩০ দিনের মধ্যে নতুন পণ্য নেই'}
              </Text>
              <Text className="mt-1 text-center text-[9px] leading-4 text-muted">
                {type === 'boost'
                  ? 'Boost হিসেবে চিহ্নিত পণ্য যোগ হলে এখানে দেখা যাবে।'
                  : 'নতুন পণ্য যোগ হলে এক মাস পর্যন্ত এখানে দেখানো হবে।'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          productsQuery.isFetchingNextPage ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="mt-2 text-[9px] text-muted">আরও পণ্য লোড হচ্ছে...</Text>
            </View>
          ) : productsQuery.isFetchNextPageError ? (
            <Pressable
              onPress={() => void productsQuery.fetchNextPage()}
              className="items-center py-4"
            >
              <Text className="text-[10px] font-bold text-primary">আরও পণ্য লোড করতে চাপ দিন</Text>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
