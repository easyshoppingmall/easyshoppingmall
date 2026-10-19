import { useMutation } from '@tanstack/react-query';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
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
}

export function DropshippingCatalogProductCard({
  product,
  onPress,
}: DropshippingCatalogProductCardProps) {
  const detailsQuery = useDropshippingProductDetailsQuery(
    product.videoUrl ? '' : product.id
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

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-line bg-white">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, বিস্তারিত দেখুন`}
        onPress={onPress}
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
      </Pressable>

      <View className="absolute right-2 top-2 flex-row">
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

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="min-h-[104px] justify-between p-3"
      >
        <Text numberOfLines={2} className="text-[12px] font-bold leading-[18px] text-ink">
          {product.name}
        </Text>
        <View className="mt-3">
          <Text className="text-[9px] text-muted">ড্রপশিপিং মূল্য</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[14px] font-extrabold text-primary-dark">
            {product.dropshippingPrice === undefined
              ? 'মূল্য পাওয়া যায়নি'
              : formatDropshippingTaka(product.dropshippingPrice)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
