import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  formatTaka,
  toBengaliNumber,
  isRemoteImage,
} from '../data/catalog';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { addToCart, toggleWishlist } from '../../../store/cartSlice';
import { colors } from '../../../shared/theme/colors';
import { getProductById } from '../api/homeApi';
import {
  customerApi,
  mapWishlistProductIds,
  responseMessage,
} from '../api/customerApi';

function couponDescription(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  const coupon = value as Record<string, unknown>;
  const code = coupon.code ?? coupon.couponCode ?? coupon.name;
  const discount = coupon.discountPercent ?? coupon.discountPercentage ?? coupon.discountAmount;
  const description = coupon.description;
  return [code, discount ? `${String(discount)} ছাড়` : undefined, description]
    .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    .join(' · ');
}

export const ProductDetailsScreen: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const dispatch = useAppDispatch();
  const cartCount = useAppSelector((state) => state.cart.totalQuantity);
  const wishlist = useAppSelector((state) => state.cart.wishlist);
  const userId = useAppSelector((state) => state.auth.user?._id);
  const queryClient = useQueryClient();
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [showCoupons, setShowCoupons] = useState(false);
  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => {
      if (!id) throw new Error('পণ্যের আইডি পাওয়া যায়নি');
      return getProductById(id);
    },
    enabled: Boolean(id),
  });

  const product = productQuery.data;
  const wishlistQuery = useQuery({
    queryKey: ['customer', 'wishlist', userId],
    queryFn: async () => mapWishlistProductIds(await customerApi.getWishlist()),
    enabled: Boolean(userId),
  });
  const reviewsQuery = useQuery({
    queryKey: ['customer', 'reviews', id],
    queryFn: () => customerApi.getReviews(id!),
    enabled: Boolean(id),
  });
  const couponsQuery = useQuery({
    queryKey: ['customer', 'product-coupons', id],
    queryFn: () => customerApi.getProductCoupons(id!),
    enabled: Boolean(id) && showCoupons,
  });
  const isFavorited =
    wishlist.includes(product?.id ?? '') ||
    (wishlistQuery.data ?? []).includes(product?.id ?? '');
  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('পণ্যের তথ্য নেই।');
      return isFavorited
        ? customerApi.removeWishlistItem(product.id)
        : customerApi.addWishlistItem(product.id);
    },
    onSuccess: () => {
      if (product) dispatch(toggleWishlist(product.id));
      void queryClient.invalidateQueries({ queryKey: ['customer', 'wishlist', userId] });
    },
    onError: (error) =>
      Alert.alert('উইশলিস্ট আপডেট হয়নি', responseMessage(error, 'আবার চেষ্টা করুন।')),
  });
  const addCartMutation = useMutation({
    mutationFn: async (shouldNavigateToCart: boolean) => {
      if (!product || !userId) throw new Error('কার্টে যোগ করার আগে লগইন করুন।');
      await customerApi.addCartItem({
        userId,
        productId: product.id,
        quantity,
        size: product.sizes ? selectedSize : undefined,
        color: selectedColor,
      });
      return shouldNavigateToCart;
    },
    onSuccess: async (shouldNavigateToCart) => {
      if (!product) return;
      dispatch(addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        category: product.category,
        quantity,
        selectedSize: product.sizes ? selectedSize : undefined,
        selectedColor,
      }));
      await queryClient.invalidateQueries({ queryKey: ['customer', 'cart', userId] });
      if (shouldNavigateToCart) {
        router.push('/(ecommerce)/(tabs)/cart');
      } else {
        Alert.alert('কার্টে যোগ হয়েছে', `${product.name} কার্টে যোগ করা হয়েছে।`);
      }
    },
    onError: (error) => Alert.alert('কার্টে যোগ হয়নি', responseMessage(error, 'আবার চেষ্টা করুন।')),
  });
  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('পণ্যের আইডি নেই।');
      return customerApi.createReview(id, { rating: reviewRating, comment: reviewComment.trim() });
    },
    onSuccess: () => {
      setReviewComment('');
      void queryClient.invalidateQueries({ queryKey: ['customer', 'reviews', id] });
      Alert.alert('ধন্যবাদ', 'আপনার রিভিউ জমা হয়েছে।');
    },
    onError: (error) => Alert.alert('রিভিউ জমা হয়নি', responseMessage(error, 'আবার চেষ্টা করুন।')),
  });
  const deleteReviewMutation = useMutation({
    mutationFn: customerApi.deleteReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customer', 'reviews', id] }),
    onError: (error) => Alert.alert('রিভিউ মুছতে পারেনি', responseMessage(error, 'আবার চেষ্টা করুন।')),
  });

  // Component state matching media_1791997921627.jpg
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(
    product?.sizes?.[1] || product?.sizes?.[0] || 'L'
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    product?.colors?.[0]?.name || 'লাইট ব্লু'
  );
  const [quantity, setQuantity] = useState(1);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Only use images provided by the product API.
  const gallery = product?.gallery?.length
    ? product.gallery
    : product
      ? [product.image]
      : [];

  if (id && productQuery.isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-3 text-[13px] text-muted">পণ্যের তথ্য লোড হচ্ছে...</Text>
      </SafeAreaView>
    );
  }

  if (id && productQuery.isError) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="alert-circle-outline" size={42} color={colors.accent} />
        <Text className="mt-3 text-center text-[15px] font-bold text-ink">
          {productQuery.error instanceof Error ? productQuery.error.message : 'পণ্যটি লোড করা যায়নি'}
        </Text>
        <TouchableOpacity
          onPress={() => void productQuery.refetch()}
          className="mt-4 rounded-xl bg-primary px-5 py-3"
        >
          <Text className="font-bold text-white">আবার চেষ্টা করুন</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-3 p-2">
          <Text className="font-semibold text-primary">ফিরে যান</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!id || !product) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="alert-circle-outline" size={42} color={colors.accent} />
        <Text className="mt-3 text-center text-[15px] font-bold text-ink">
          পণ্যের তথ্য পাওয়া যায়নি
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-3 p-2">
          <Text className="font-semibold text-primary">ফিরে যান</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Handle quantity changes
  const handleIncrease = () => {
    if (product.stockCount === undefined || quantity < product.stockCount) {
      setQuantity((prev) => prev + 1);
    } else {
      Alert.alert('স্টক সীমা', 'স্টকে থাকা সর্বোচ্চ পরিমাণ নির্বাচন করা হয়েছে।');
    }
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  // Add to Cart
  const handleAddToCart = (shouldNavigateToCart = false) =>
    addCartMutation.mutate(shouldNavigateToCart);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      {/* Top Header matching media_1791997921627.jpg */}
      <View className="flex-row items-center justify-between px-4 py-2.5 border-b border-line bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-full items-center justify-center -ml-1"
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-primary">
          EasyShoppingMallBD
        </Text>

        <View className="flex-row items-center space-x-3">
          <TouchableOpacity
            onPress={() => wishlistMutation.mutate()}
            disabled={wishlistMutation.isPending}
            activeOpacity={0.7}
            className="p-1 mr-2"
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorited ? colors.accent : colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(ecommerce)/(tabs)/cart')}
            activeOpacity={0.7}
            className="w-9 h-9 rounded-full bg-primary-light items-center justify-center relative"
          >
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
            {cartCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-[17px] h-[17px] px-1 items-center justify-center border border-white">
                <Text className="text-white text-[9px] font-bold">
                  {toBengaliNumber(cartCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* Product Image Gallery with Left Thumbnails & Big Image */}
        <View className="flex-row px-4 pt-3 pb-2">
          {/* Vertical Thumbnails on the left */}
          <View className="w-14 mr-2.5 space-y-2">
            {gallery.map((img, idx) => {
              const isSelected = selectedImageIndex === idx;
              return (
                <TouchableOpacity
                  key={`thumb-${idx}`}
                  activeOpacity={0.8}
                  onPress={() => setSelectedImageIndex(idx)}
                  className={`w-14 h-14 rounded-[10px] items-center justify-center mb-2 border-2 ${
                    isSelected ? 'border-primary' : 'border-line'
                  }`}
                  style={{ backgroundColor: product.bgColor || colors.tintBlue }}
                >
                  {isRemoteImage(img) ? (
                    <Image source={{ uri: img }} resizeMode="cover" className="h-full w-full rounded-[8px]" />
                  ) : (
                    <Text className="text-[24px]">{img}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Main Big Product Image with Dots & Next arrow */}
          <View
            className="flex-1 h-[256px] rounded-[16px] relative items-center justify-center overflow-hidden border border-line"
            style={{ backgroundColor: product.bgColor || colors.tintBlue }}
          >
            {isRemoteImage(gallery[selectedImageIndex]) ? (
              <Image
                source={{ uri: gallery[selectedImageIndex] }}
                resizeMode="contain"
                className="h-full w-full"
              />
            ) : (
              <Text className="text-[88px]">{gallery[selectedImageIndex]}</Text>
            )}

            {/* Next arrow on right side */}
            <TouchableOpacity
              onPress={() =>
                setSelectedImageIndex((prev) => (prev + 1) % gallery.length)
              }
              activeOpacity={0.7}
              className="absolute right-2 top-1/2 -mt-4 w-8 h-8 rounded-full bg-white/80 items-center justify-center shadow-sm"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.ink} />
            </TouchableOpacity>

            {/* Pagination dots at bottom */}
            <View className="absolute bottom-2 flex-row items-center space-x-1.5 bg-black/10 px-2.5 py-1 rounded-full">
              {gallery.map((_, i) => (
                <View
                  key={`dot-${i}`}
                  className={`h-2 rounded-full mx-0.5 ${
                    i === selectedImageIndex
                      ? 'w-4 bg-primary'
                      : 'w-2 bg-white/80'
                  }`}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Product Details Content */}
        <View className="px-4 mt-2">
          {/* Title with Verified Tick */}
          <View className="flex-row items-center">
            <Text className="text-[18px] font-bold text-ink mr-1.5 flex-1">
              {product.name}
            </Text>
            {product.isVerified && (
              <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
            )}
          </View>

          {/* Subtitle */}
          {product.subtitle && (
            <Text className="text-[12px] text-muted font-normal mt-0.5">
              {product.subtitle}
            </Text>
          )}

          {/* Price, Discount & Stock Row */}
          <View className="flex-row items-center justify-between mt-2.5">
            <View className="flex-row items-center">
              <Text
                className="text-[22px] font-extrabold"
                style={{ color: colors.primary }}
              >
                {formatTaka(product.price)}
              </Text>
              {product.originalPrice && (
                <Text className="text-muted text-[13px] line-through ml-2">
                  {formatTaka(product.originalPrice)}
                </Text>
              )}
              {product.discount && (
                <View className="ml-2.5 bg-primary px-2 py-0.5 rounded-full">
                  <Text className="text-white text-[11px] font-bold">
                    {product.discount}
                  </Text>
                </View>
              )}
            </View>

            {/* Rating and Stock Status */}
            <View className="items-end">
              {product.rating ? (
                <View className="flex-row items-center">
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text className="ml-1 text-[12px] font-bold text-ink">{product.rating}</Text>
                </View>
              ) : null}
              <Text className="ml-0.5 text-[11px] text-muted">
                ({toBengaliNumber(product.reviewsCount ?? reviewsQuery.data?.length ?? 0)} রিভিউ)
              </Text>
              {product.stockCount !== undefined ? (
                <View className="mt-1 flex-row items-center">
                  <View className={`mr-1.5 h-2 w-2 rounded-full ${product.stockCount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <Text className={`text-[11px] font-semibold ${product.stockCount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {product.stockCount > 0
                      ? `স্টক আছে (${toBengaliNumber(product.stockCount)} পিস)`
                      : 'স্টক নেই'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="h-[1px] bg-line my-3" />

          {/* Size Selector (If sizes available) */}
          {product.sizes && (
            <View className="mb-3.5">
              <Text className="mb-2 text-[13px] font-bold text-ink">সাইজ নির্বাচন করুন</Text>

              <View className="flex-row space-x-2">
                {product.sizes.map((sz) => {
                  const isSelected = selectedSize === sz;
                  return (
                    <TouchableOpacity
                      key={sz}
                      activeOpacity={0.7}
                      onPress={() => setSelectedSize(sz)}
                      className={`min-w-[48px] py-1.5 px-3 rounded-[8px] items-center justify-center border mr-2 ${
                        isSelected
                          ? 'border-primary bg-primary-light'
                          : 'border-line bg-card'
                      }`}
                    >
                      <Text
                        className={`text-[13px] font-bold ${
                          isSelected ? 'text-primary' : 'text-ink'
                        }`}
                      >
                        {sz}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Color Selector */}
          {product.colors && (
            <View className="mb-3.5">
              <Text className="text-[13px] font-bold text-ink mb-2">রঙ</Text>
              <View className="flex-row space-x-4">
                {product.colors.map((c) => {
                  const isSelected = selectedColor === c.name;
                  return (
                    <TouchableOpacity
                      key={c.name}
                      activeOpacity={0.8}
                      onPress={() => setSelectedColor(c.name)}
                      className="items-center mr-3"
                    >
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center p-0.5 border-2 ${
                          isSelected ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <View
                          className="w-7 h-7 rounded-full border border-line"
                          style={{ backgroundColor: c.colorCode }}
                        />
                      </View>
                      <Text
                        className={`text-[10px] mt-1 ${
                          isSelected
                            ? 'text-primary font-bold'
                            : 'text-muted font-normal'
                        }`}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity Selector */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[13px] font-bold text-ink">পরিমাণ</Text>
            <View className="flex-row items-center">
              <View className="flex-row items-center border border-line rounded-[8px] bg-card px-1 py-0.5">
                <TouchableOpacity
                  onPress={handleDecrease}
                  activeOpacity={0.7}
                  className="w-7 h-7 items-center justify-center"
                >
                  <Text className="text-[16px] font-bold text-ink">−</Text>
                </TouchableOpacity>

                <View className="w-8 items-center justify-center">
                  <Text className="text-[13px] font-bold text-ink">
                    {toBengaliNumber(quantity)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleIncrease}
                  activeOpacity={0.7}
                  className="w-7 h-7 items-center justify-center"
                >
                  <Text className="text-[16px] font-bold text-ink">＋</Text>
                </TouchableOpacity>
              </View>
              {product.stockCount !== undefined ? (
                <Text className="ml-2 text-[11px] text-muted">
                  সর্বোচ্চ {toBengaliNumber(product.stockCount)} পিস
                </Text>
              ) : null}
            </View>
          </View>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <View className="flex-row space-x-3 mb-4">
            {/* Add to Cart Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleAddToCart(false)}
              disabled={addCartMutation.isPending}
              className="flex-1 flex-row items-center justify-center py-3 rounded-[11px] border border-primary bg-primary-light mr-2"
            >
              <Ionicons name="cart-outline" size={18} color={colors.primary} />
              <Text className="ml-1.5 text-[13px] font-bold text-primary">
                {addCartMutation.isPending ? 'যোগ হচ্ছে...' : 'কার্টে যোগ করুন'}
              </Text>
            </TouchableOpacity>

            {/* Buy Now Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleAddToCart(true)}
              disabled={addCartMutation.isPending}
              className="flex-1 flex-row items-center justify-center py-3 rounded-[11px] bg-primary"
              style={{
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="flash" size={17} color="#FFFFFF" />
              <Text className="text-[13px] font-bold text-white ml-1.5">
                এখনই কিনুন
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description Section */}
          <View className="border-t border-line pt-3 mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center">
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text className="text-[14px] font-bold text-ink ml-1.5">
                  বিবরণ
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                activeOpacity={0.7}
                className="flex-row items-center"
              >
                <Text className="text-[11px] text-primary font-semibold mr-0.5">
                  {isDescriptionExpanded ? 'কম দেখুন' : 'আরও দেখুন'}
                </Text>
                <Ionicons
                  name={isDescriptionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <Text
              numberOfLines={isDescriptionExpanded ? undefined : 3}
              className="text-[12px] text-muted leading-[19px]"
            >
              {product.description || 'এই পণ্যের বিস্তারিত বিবরণ দেওয়া হয়নি।'}
            </Text>
          </View>

          <View className="mb-5 border-t border-line pt-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-ink">গ্রাহকের রিভিউ</Text>
              <TouchableOpacity onPress={() => setShowCoupons((visible) => !visible)}>
                <Text className="text-[11px] font-bold text-primary">কুপন দেখুন</Text>
              </TouchableOpacity>
            </View>
            {showCoupons ? (
              <View className="mb-3 rounded-xl bg-primary-light p-3">
                {couponsQuery.isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : couponsQuery.isError ? (
                  <Text className="text-[11px] text-red-700">{couponsQuery.error.message}</Text>
                ) : couponsQuery.data?.length ? (
                  couponsQuery.data.map((coupon, index) => (
                    <Text key={index} className="mb-1 text-[11px] font-semibold text-primary">
                      {couponDescription(coupon) || 'কুপনের তথ্য'}
                    </Text>
                  ))
                ) : (
                  <Text className="text-[11px] text-muted">এই পণ্যে কোনো কুপন নেই।</Text>
                )}
              </View>
            ) : null}
            {reviewsQuery.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : reviewsQuery.isError ? (
              <TouchableOpacity onPress={() => void reviewsQuery.refetch()}>
                <Text className="text-[11px] text-red-700">
                  রিভিউ লোড হয়নি: {reviewsQuery.error.message} · আবার চেষ্টা
                </Text>
              </TouchableOpacity>
            ) : reviewsQuery.data?.length ? (
              reviewsQuery.data.map((review) => (
                <View key={review._id} className="mb-2 rounded-xl border border-line bg-card p-3">
                  <View className="flex-row items-center">
                    <Text className="flex-1 text-[11px] font-bold text-ink">
                      {typeof review.user === 'object' ? review.user?.name ?? 'গ্রাহক' : 'গ্রাহক'}
                      {review.rating ? ` · ★ ${review.rating}` : ''}
                    </Text>
                    {userId && typeof review.user === 'object' && review.user?._id === userId ? (
                      <TouchableOpacity onPress={() => deleteReviewMutation.mutate(review._id)}>
                        <Text className="text-[10px] font-semibold text-red-600">মুছুন</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-[12px] leading-5 text-muted">
                    {review.comment ?? review.review ?? ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="mb-2 text-[11px] text-muted">এখনো কোনো রিভিউ নেই।</Text>
            )}
            <View className="rounded-xl border border-line bg-card p-3">
              <Text className="mb-2 text-[12px] font-semibold text-ink">আপনার রেটিং</Text>
              <View className="mb-2 flex-row">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <TouchableOpacity key={rating} onPress={() => setReviewRating(rating)} className="mr-1">
                    <Ionicons name={rating <= reviewRating ? 'star' : 'star-outline'} size={23} color="#F59E0B" />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="আপনার অভিজ্ঞতা লিখুন"
                multiline
                className="min-h-20 rounded-xl border border-line bg-white px-3 py-2 text-[12px] text-ink"
              />
              <TouchableOpacity
                disabled={!reviewComment.trim() || reviewMutation.isPending}
                onPress={() => reviewMutation.mutate()}
                className="mt-2 self-start rounded-xl bg-primary px-4 py-2"
              >
                <Text className="text-[11px] font-bold text-white">
                  {reviewMutation.isPending ? 'পাঠানো হচ্ছে...' : 'রিভিউ জমা দিন'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
};

export default ProductDetailsScreen;
