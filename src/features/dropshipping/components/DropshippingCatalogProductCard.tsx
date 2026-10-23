import { useMutation } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingTaka } from '../api/homeApi';
import { downloadDropshippingImage } from '../api/imageDownload';
import type { DropshippingProduct } from '../api/homeApi';
import { useDropshippingProductDetailsQuery } from '../api/queries';

interface DropshippingCatalogProductCardProps {
  product: DropshippingProduct;
  onPress: () => void;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  wishlistDisabled: boolean;
  wishlistPending: boolean;
  isVisible: boolean;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}

export function DropshippingCatalogProductCard({
  product,
  onPress,
  isWishlisted,
  onToggleWishlist,
  wishlistDisabled,
  wishlistPending,
  isVisible,
  onCheckout,
  checkoutDisabled,
}: DropshippingCatalogProductCardProps) {
  const detailsQuery = useDropshippingProductDetailsQuery(
    product.videoUrl || !isVisible ? '' : product.id
  );
  const videoUrl = product.videoUrl || detailsQuery.data?.videoUrl;
  const downloadMutation = useMutation({
    mutationFn: () => {
      if (!product.image) throw new Error('এই পণ্যের ছবি পাওয়া যায়নি।');
      return downloadDropshippingImage(product.id, product.image);
    },
    onError: (error) => {
      Alert.alert(
        'ছবি ডাউনলোড হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
    onSuccess: () => Alert.alert('ছবি সংরক্ষিত', 'পণ্যের ছবি গ্যালারিতে সেভ হয়েছে।'),
  });

  const openVideo = async () => {
    if (!videoUrl) return;
    try {
      await Linking.openURL(videoUrl);
    } catch {
      Alert.alert('ভিডিও খোলা যায়নি', 'ভিডিও লিংকটি পরে আবার চেষ্টা করুন।');
    }
  };

  const estimatedProfit =
    product.productRank !== undefined && product.dropshippingPrice !== undefined
      ? product.productRank - product.dropshippingPrice
      : undefined;

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-white" style={{ width: '100%' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, বিস্তারিত দেখুন`}
        onPress={onPress}
        className="h-[112px] items-center justify-center overflow-hidden bg-primary-light"
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
      </Pressable>

      <View className="absolute right-2 top-2 flex-row">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isWishlisted ? `${product.name} উইশলিস্ট থেকে সরান` : `${product.name} উইশলিস্টে যোগ করুন`}
          accessibilityState={{ selected: isWishlisted, disabled: wishlistDisabled }}
          disabled={wishlistDisabled}
          onPress={onToggleWishlist}
          className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-white/95"
        >
          {wishlistPending ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={18} color="#DC2626" />
          )}
        </Pressable>
        {videoUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${product.name} ভিডিও খুলুন`}
            onPress={() => void openVideo()}
            className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-black/65"
          >
            <Ionicons name="videocam" size={17} color="#FFFFFF" />
          </Pressable>
        ) : null}
        {product.image ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${product.name} ছবিটি ডাউনলোড করুন`}
            disabled={downloadMutation.isPending}
            onPress={() => downloadMutation.mutate()}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/95"
          >
            {downloadMutation.isPending ? (
              <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={17} color={colors.primary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {product.discount && product.discount > 0 ? (
        <View className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1">
          <Text className="text-[9px] font-bold text-white">{product.discount}% ছাড়</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="min-h-[134px] justify-between p-2.5"
      >
        {product.brand ? (
          <Text numberOfLines={1} className="mb-1 text-[9px] font-medium text-muted">
            {product.brand}
          </Text>
        ) : null}
        <Text numberOfLines={2} className="min-h-[32px] text-[11px] font-bold leading-4 text-ink">
          {product.name}
        </Text>
        <View className="mt-1.5">
          <Text className="text-[8px] text-muted">ড্রপশিপিং খরচ</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[12px] font-extrabold text-primary-dark">
            {product.dropshippingPrice === undefined
              ? 'API-তে নেই'
              : formatDropshippingTaka(product.dropshippingPrice)}
          </Text>
          <Text className="mt-1 text-[8px] text-muted">প্রস্তাবিত বিক্রয়মূল্য</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[11px] font-bold text-ink">
            {product.productRank === undefined
              ? 'API-তে নেই'
              : formatDropshippingTaka(product.productRank)}
          </Text>
          <Text className="mt-1 text-[8px] text-muted">ক্যাটালগ মূল্য (Dropshipping Cost নয়)</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[10px] font-semibold text-ink">
            {formatDropshippingTaka(product.price)}
          </Text>
          <Text className={`mt-1 text-[9px] font-bold ${estimatedProfit === undefined ? 'text-muted' : estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {estimatedProfit === undefined
              ? 'লাভ: খরচের তথ্য নেই'
              : `আনুমানিক লাভ: ${formatDropshippingTaka(estimatedProfit)} / পিস`}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name} কার্টে যোগ করে checkout`}
        accessibilityState={{ disabled: checkoutDisabled }}
        disabled={checkoutDisabled}
        onPress={onCheckout}
        className={`mx-2.5 mb-2.5 min-h-10 flex-row items-center justify-center rounded-xl px-2 ${
          checkoutDisabled ? 'bg-primary/40' : 'bg-primary'
        }`}
      >
        <Ionicons name="cart-outline" size={15} color="#FFFFFF" />
        <Text numberOfLines={1} className="ml-1.5 text-[10px] font-bold text-white">
          {product.stockCount === 0 ? 'স্টক নেই' : 'কার্টে যোগ • Checkout'}
        </Text>
      </Pressable>
    </View>
  );
}
