import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingTaka } from '../api/homeApi';
import { downloadDropshippingImage } from '../api/imageDownload';
import {
  dropshippingHomeQueryKeys,
  useDropshippingProductDetailsQuery,
  useDropshippingWishlistQuery,
} from '../api/queries';
import {
  addDropshippingWishlistProduct,
  removeDropshippingWishlistProduct,
} from '../api/wishlistApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { addDropshippingCartItem } from '../../../store/dropshippingCartSlice';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function DropshippingProductDetailsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = firstParam(params.id);
  const productQuery = useDropshippingProductDetailsQuery(productId);
  const wishlistQuery = useDropshippingWishlistQuery();
  const { width: screenWidth } = useWindowDimensions();
  const product = productQuery.data;
  const images = product?.images?.length
    ? product.images
    : product?.image
      ? [product.image]
      : [];
  const [imageSelection, setImageSelection] = useState({ productId: '', index: 0 });
  const [variantSelection, setVariantSelection] = useState({
    productId: '',
    size: '',
    color: '',
    weight: '',
  });
  const selectedImage = imageSelection.productId === product?.id ? imageSelection.index : 0;
  const selectedSize = variantSelection.productId === product?.id
    ? variantSelection.size
    : product?.sizes?.[0] ?? '';
  const selectedColor = variantSelection.productId === product?.id
    ? variantSelection.color
    : product?.colors?.[0] ?? '';
  const selectedWeight = variantSelection.productId === product?.id
    ? variantSelection.weight
    : product?.weights?.[0] ?? '';
  const selectedCartQuantity = useAppSelector((state) => state.dropshippingCart.items.find((item) =>
    item.product.id === product?.id &&
    item.size === selectedSize &&
    item.color === selectedColor &&
    item.weight === selectedWeight
  )?.quantity ?? 0);
  const cannotAddSelectedStock = product?.stockCount !== undefined &&
    selectedCartQuantity >= product.stockCount;

  const downloadMutation = useMutation({
    mutationFn: () => {
      const image = images[selectedImage];
      if (!image || !product) throw new Error('এই পণ্যের ছবি পাওয়া যায়নি।');
      return downloadDropshippingImage(product.id, image);
    },
    onError: (error) => {
      Alert.alert(
        'ছবি ডাউনলোড হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
    onSuccess: () => Alert.alert('ছবি সংরক্ষিত', 'পণ্যের ছবি গ্যালারিতে সেভ হয়েছে।'),
  });
  const isWishlisted = wishlistQuery.data?.some((item) => item.id === productId) ?? false;
  const wishlistMutation = useMutation({
    mutationFn: () => isWishlisted
      ? removeDropshippingWishlistProduct(productId)
      : addDropshippingWishlistProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dropshippingHomeQueryKeys.wishlist(userId ?? ''),
      });
      Alert.alert(
        isWishlisted ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'উইশলিস্টে যোগ হয়েছে',
        isWishlisted ? 'পণ্যটি আপনার পছন্দের তালিকা থেকে সরানো হয়েছে।' : 'পণ্যটি আপনার পছন্দের তালিকায় সংরক্ষিত হয়েছে।'
      );
    },
    onError: (error) => {
      Alert.alert(
        'উইশলিস্ট আপডেট হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
  });

  const openVideo = async () => {
    if (!product?.videoUrl) return;
    try {
      await Linking.openURL(product.videoUrl);
    } catch {
      Alert.alert('ভিডিও খোলা যায়নি', 'ভিডিও লিংকটি পরে আবার চেষ্টা করুন।');
    }
  };

  const copyDescription = async () => {
    if (!product?.description) return;
    try {
      await Clipboard.setStringAsync(product.description);
      Alert.alert('কপি হয়েছে', 'পণ্যের বিবরণ ক্লিপবোর্ডে কপি করা হয়েছে।');
    } catch {
      Alert.alert('কপি করা যায়নি', 'আবার চেষ্টা করুন।');
    }
  };

  if (!productId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="alert-circle-outline" size={40} color={colors.accent} />
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          পণ্যের আইডি পাওয়া যায়নি।
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3 px-4 py-2">
          <Text className="text-[11px] font-semibold text-primary">ফিরে যান</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (productQuery.isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-3 text-[12px] text-muted">পণ্যের তথ্য লোড হচ্ছে...</Text>
      </SafeAreaView>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="alert-circle-outline" size={40} color={colors.accent} />
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          {productQuery.error?.message || 'পণ্যের তথ্য পাওয়া যায়নি।'}
        </Text>
        <Pressable
          onPress={() => void productQuery.refetch()}
          className="mt-4 rounded-xl bg-primary px-5 py-3"
        >
          <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-3 px-4 py-2">
          <Text className="text-[11px] font-semibold text-primary">ফিরে যান</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="আগের পাতায় ফিরুন"
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-[15px] font-extrabold text-ink">পণ্যের বিস্তারিত</Text>
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isWishlisted ? 'উইশলিস্ট থেকে সরান' : 'উইশলিস্টে যোগ করুন'}
            accessibilityState={{ selected: isWishlisted, disabled: wishlistMutation.isPending }}
            disabled={wishlistMutation.isPending || wishlistQuery.isPending}
            onPress={() => wishlistMutation.mutate()}
            className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-red-50"
          >
            {wishlistMutation.isPending ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={20} color="#DC2626" />
            )}
          </Pressable>
          {product.videoUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="পণ্যের ভিডিও খুলুন"
              onPress={() => void openVideo()}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary-light"
            >
              <Ionicons name="videocam" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 32 }}
      >
        <View style={{ width: Math.min(Math.max(screenWidth - 32, 0), 960) }} className="pt-4">
          <View className="overflow-hidden rounded-[24px] border border-line bg-white">
            <View className="h-[340px] items-center justify-center overflow-hidden bg-primary-light">
              {images[selectedImage] ? (
                <Image
                  source={{ uri: images[selectedImage] }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  recyclingKey={`${product.id}-${selectedImage}`}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Ionicons name="cube-outline" size={54} color={colors.primary} />
              )}
              {images[selectedImage] ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="পণ্যের ছবি ডাউনলোড করুন"
                  disabled={downloadMutation.isPending}
                  onPress={() => downloadMutation.mutate()}
                  className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-white"
                >
                  {downloadMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ) : null}
            </View>
            {images.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 py-3">
                {images.map((image, index) => (
                  <Pressable
                    key={`${product.id}-image-${index}`}
                    onPress={() => setImageSelection({ productId: product.id, index })}
                    className={`mr-2 h-16 w-16 overflow-hidden rounded-xl border ${selectedImage === index ? 'border-primary' : 'border-line'}`}
                  >
                    <Image
                      source={{ uri: image }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View className="mt-4 rounded-[22px] border border-line bg-white p-5">
            {product.brand ? (
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                {product.brand}
              </Text>
            ) : null}
            <Text className="mt-1 text-[19px] font-extrabold leading-7 text-ink">{product.name}</Text>

            <View className="mt-4 rounded-2xl bg-primary-light px-4 py-3">
              <Text className="text-[10px] font-medium text-muted">আপনার পণ্য খরচ</Text>
              <Text className="mt-1 text-[22px] font-extrabold text-primary-dark">
                {product.dropshippingPrice === undefined
                  ? 'মূল্য পাওয়া যায়নি'
                  : formatDropshippingTaka(product.dropshippingPrice)}
              </Text>
              <Text className="mt-3 text-[10px] font-medium text-muted">
                প্রস্তাবিত বিক্রয়মূল্য (Product Rank)
              </Text>
              <Text className="mt-1 text-[18px] font-extrabold text-ink">
                {product.productRank === undefined
                  ? 'তথ্য পাওয়া যায়নি'
                  : formatDropshippingTaka(product.productRank)}
              </Text>
              {product.productRank !== undefined && product.dropshippingPrice !== undefined ? (
                <Text className={`mt-1 text-[11px] font-bold ${product.productRank >= product.dropshippingPrice ? 'text-emerald-700' : 'text-red-600'}`}>
                  আনুমানিক লাভ: {formatDropshippingTaka(product.productRank - product.dropshippingPrice)} / পিস
                </Text>
              ) : null}
            </View>

            {product.description ? (
              <View className="mt-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] font-bold text-ink">পণ্যের বিবরণ</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="পণ্যের বিবরণ কপি করুন"
                    onPress={() => void copyDescription()}
                    className="min-h-9 flex-row items-center rounded-lg bg-primary-light px-3"
                  >
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                    <Text className="ml-1.5 text-[10px] font-bold text-primary-dark">কপি</Text>
                  </Pressable>
                </View>
                <Text className="mt-2 text-[12px] leading-6 text-muted">
                  {product.description}
                </Text>
              </View>
            ) : null}

            <View className="mt-5 border-t border-line pt-4">
              <Text className="mb-3 text-[13px] font-bold text-ink">পণ্যের তথ্য</Text>
              {[
                ['স্টক', product.stockCount === undefined ? undefined : `${product.stockCount}টি`],
                ['SKU', product.sku],
                ['ক্যাটাগরি', product.categoryNames?.join(', ')],
                ['সাবক্যাটাগরি', product.subcategoryNames?.join(', ')],
                ['ওজন', product.weights?.join(', ')],
              ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                <View key={label} className="mb-2 flex-row">
                  <Text className="w-24 text-[11px] text-muted">{label}</Text>
                  <Text className="flex-1 text-[11px] font-medium text-ink">{value}</Text>
                </View>
              ))}
              {product.stockCount === 0 ? (
                <Text className="mt-1 text-[11px] font-semibold text-red-600">এই পণ্যটি বর্তমানে স্টকে নেই।</Text>
              ) : null}
            </View>

            {product.sizes?.length || product.colors?.length ? (
              <View className="mt-4 border-t border-line pt-4">
                <Text className="mb-3 text-[13px] font-bold text-ink">আপনার পছন্দ বাছুন</Text>
                {product.sizes?.length ? (
                  <View className="mb-3">
                    <Text className="mb-2 text-[10px] font-semibold text-muted">সাইজ</Text>
                    <View className="flex-row flex-wrap">
                      {product.sizes.map((size) => (
                        <Pressable
                          key={size}
                          onPress={() => setVariantSelection({
                            productId: product.id,
                            size,
                            color: selectedColor,
                            weight: selectedWeight,
                          })}
                          className={`mb-2 mr-2 rounded-lg border px-3 py-2 ${selectedSize === size ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
                        >
                          <Text className={`text-[11px] font-semibold ${selectedSize === size ? 'text-primary-dark' : 'text-ink'}`}>{size}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                {product.colors?.length ? (
                  <View>
                    <Text className="mb-2 text-[10px] font-semibold text-muted">রং</Text>
                    <View className="flex-row flex-wrap">
                      {product.colors.map((color) => (
                        <Pressable
                          key={color}
                          onPress={() => setVariantSelection({
                            productId: product.id,
                            size: selectedSize,
                            color,
                            weight: selectedWeight,
                          })}
                          className={`mb-2 mr-2 rounded-lg border px-3 py-2 ${selectedColor === color ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
                        >
                          <Text className={`text-[11px] font-semibold ${selectedColor === color ? 'text-primary-dark' : 'text-ink'}`}>{color}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={(product.stockCount !== undefined && product.stockCount <= 0) ||
                cannotAddSelectedStock}
              onPress={() => {
                dispatch(addDropshippingCartItem({
                  product,
                  size: selectedSize,
                  color: selectedColor,
                  weight: selectedWeight,
                }));
                router.push('/(dropshipping)/cart');
              }}
              className={`mt-5 min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3 ${(product.stockCount !== undefined && product.stockCount <= 0) || cannotAddSelectedStock ? 'bg-primary/50' : 'bg-primary'}`}
            >
              <Ionicons name="bag-check-outline" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-[12px] font-bold text-white">
                {product.stockCount === 0
                  ? 'স্টক নেই'
                  : cannotAddSelectedStock ? 'স্টক সীমা কার্টে যোগ হয়েছে' : 'কার্টে যোগ করে Checkout'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingProductDetailsScreen;
