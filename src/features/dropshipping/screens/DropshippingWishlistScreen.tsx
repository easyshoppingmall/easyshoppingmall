import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
} from '../api/homeApi';
import {
  removeDropshippingWishlistProduct,
  type DropshippingWishlistProduct,
} from '../api/wishlistApi';
import {
  dropshippingHomeQueryKeys,
  useDropshippingWishlistQuery,
} from '../api/queries';

function WishlistSkeleton({ columns }: { columns: number }) {
  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: columns * 2 }, (_, index) => (
        <View
          key={index}
          className="mb-3 overflow-hidden rounded-2xl border border-line bg-white"
          style={{ width: `${100 / columns - 2}%` }}
        >
          <View className="h-[150px] bg-slate-200" />
          <View className="p-3">
            <View className="h-3 w-4/5 rounded bg-slate-200" />
            <View className="mt-2 h-3 w-2/5 rounded bg-slate-200" />
            <View className="mt-3 h-9 rounded-lg bg-slate-100" />
          </View>
        </View>
      ))}
    </View>
  );
}

function WishlistProductCard({
  product,
  onOpen,
  onRemove,
  removing,
  width,
}: {
  product: DropshippingWishlistProduct;
  onOpen: () => void;
  onRemove: () => void;
  removing: boolean;
  width: number;
}) {
  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border border-line bg-white"
      style={{ width }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, বিস্তারিত দেখুন`}
        onPress={onOpen}
        className="h-[150px] items-center justify-center overflow-hidden bg-primary-light"
      >
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Ionicons name="cube-outline" size={38} color={colors.primary} />
        )}
        <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1">
          <Text className="text-[8px] font-semibold text-white">ড্রপশিপিং পণ্য</Text>
        </View>
      </Pressable>

      <View className="p-3">
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text numberOfLines={2} className="min-h-[36px] text-[12px] font-bold leading-[18px] text-ink">
            {product.name}
          </Text>
        </Pressable>
        {product.brand ? (
          <Text numberOfLines={1} className="mt-1 text-[9px] text-muted">{product.brand}</Text>
        ) : null}
        <View className="mt-3 rounded-xl bg-primary-light px-3 py-2.5">
          <Text className="text-[9px] text-muted">ড্রপশিপিং মূল্য</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[14px] font-extrabold text-primary-dark">
            {product.dropshippingPrice === undefined
              ? 'মূল্য পাওয়া যায়নি'
              : formatDropshippingTaka(product.dropshippingPrice)}
          </Text>
        </View>
        {product.stockCount !== undefined ? (
          <View className="mt-2 flex-row items-center">
            <Ionicons
              name={product.stockCount > 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={13}
              color={product.stockCount > 0 ? '#059669' : '#DC2626'}
            />
            <Text className={`ml-1 text-[9px] ${product.stockCount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {product.stockCount > 0
                ? `স্টকে ${formatDropshippingNumber(product.stockCount)}টি`
                : 'স্টক নেই'}
            </Text>
          </View>
        ) : null}
        <View className="mt-3 flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${product.name} বিস্তারিত দেখুন`}
            onPress={onOpen}
            className="mr-2 min-h-10 flex-1 flex-row items-center justify-center rounded-xl bg-primary px-2"
          >
            <Ionicons name="eye-outline" size={15} color="#FFFFFF" />
            <Text className="ml-1.5 text-[10px] font-bold text-white">বিস্তারিত</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${product.name} উইশলিস্ট থেকে সরান`}
            disabled={removing}
            onPress={onRemove}
            className={`h-10 w-10 items-center justify-center rounded-xl bg-red-50 ${removing ? 'opacity-50' : ''}`}
          >
            {removing
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Ionicons name="heart-dislike-outline" size={17} color="#DC2626" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function DropshippingWishlistScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const wishlistQuery = useDropshippingWishlistQuery();
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(screenWidth - 32, 0), 1080);
  const columns = contentWidth >= 900 ? 4 : contentWidth >= 560 ? 3 : 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const products = wishlistQuery.data ?? [];

  const removeMutation = useMutation({
    mutationFn: removeDropshippingWishlistProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dropshippingHomeQueryKeys.wishlist(userId ?? ''),
      });
    },
    onError: (error) => {
      Alert.alert(
        'উইশলিস্ট আপডেট হয়নি',
        error instanceof Error ? error.message : 'পণ্যটি সরানো যায়নি। আবার চেষ্টা করুন।'
      );
    },
  });

  const openProduct = (product: DropshippingWishlistProduct) =>
    router.push({
      pathname: '/(dropshipping)/product/[id]',
      params: { id: product.id },
    });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-bg"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-ink">আমার উইশলিস্ট</Text>
          <Text className="mt-0.5 text-[9px] text-muted">আপনার পছন্দের ড্রপশিপিং পণ্য</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="উইশলিস্ট রিফ্রেশ"
          onPress={() => void wishlistQuery.refetch()}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary-light"
        >
          {wishlistQuery.isRefetching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
        </Pressable>
      </View>

      <View className="mx-auto w-full max-w-[1120px] flex-1 px-4">
        {!wishlistQuery.isPending && !wishlistQuery.isError ? (
          <View className="my-3 flex-row items-center rounded-2xl border border-line bg-white px-4 py-3">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <Ionicons name="heart" size={20} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-bold text-ink">সংরক্ষিত পণ্য</Text>
              <Text className="mt-0.5 text-[9px] text-muted">আপনার পছন্দের তালিকা সবসময় হাতের কাছে</Text>
            </View>
            <Text className="text-[12px] font-extrabold text-primary">
              {formatDropshippingNumber(products.length)}টি
            </Text>
          </View>
        ) : null}

        {wishlistQuery.isError ? (
          <View className="flex-1 items-center justify-center px-5">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
              <Ionicons name="cloud-offline-outline" size={30} color="#DC2626" />
            </View>
            <Text className="mt-4 text-center text-[14px] font-bold text-ink">
              উইশলিস্ট লোড করা যায়নি
            </Text>
            <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
              {wishlistQuery.error.message || 'ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void wishlistQuery.refetch()}
              className="mt-4 flex-row items-center rounded-xl bg-primary px-5 py-3"
            >
              <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
              <Text className="ml-2 text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            key={`wishlist-${columns}`}
            data={wishlistQuery.isPending ? [] : products}
            numColumns={columns}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            initialNumToRender={columns * 2}
            maxToRenderPerBatch={columns * 2}
            windowSize={5}
            columnWrapperStyle={columns > 1 ? { gap } : undefined}
            contentContainerStyle={{
              width: contentWidth,
              alignSelf: 'center',
              paddingTop: wishlistQuery.isPending ? 12 : 0,
              paddingBottom: 24,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={wishlistQuery.isRefetching}
                onRefresh={() => void wishlistQuery.refetch()}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              wishlistQuery.isPending ? (
                <WishlistSkeleton columns={columns} />
              ) : (
                <View className="flex-1 items-center justify-center px-6 py-16">
                  <View className="h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-red-50">
                    <Ionicons name="heart-outline" size={37} color="#DC2626" />
                  </View>
                  <Text className="mt-4 text-[15px] font-extrabold text-ink">উইশলিস্ট এখনো খালি</Text>
                  <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
                    পণ্য পছন্দ হলে সেটি উইশলিস্টে যোগ করুন, পরে সহজেই খুঁজে পাবেন।
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace('/(dropshipping)/all-products')}
                    className="mt-5 flex-row items-center rounded-xl bg-primary px-5 py-3"
                  >
                    <Ionicons name="grid-outline" size={16} color="#FFFFFF" />
                    <Text className="ml-2 text-[11px] font-bold text-white">পণ্য দেখুন</Text>
                  </Pressable>
                </View>
              )
            }
            renderItem={({ item }) => (
              <WishlistProductCard
                product={item}
                width={cardWidth}
                onOpen={() => openProduct(item)}
                removing={removeMutation.isPending && removeMutation.variables === item.id}
                onRemove={() => removeMutation.mutate(item.id)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default DropshippingWishlistScreen;
