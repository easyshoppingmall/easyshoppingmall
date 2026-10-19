import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingTaka,
  formatDropshippingNumber,
  type DropshippingProduct,
} from '../api/homeApi';
import { useSearchDropshippingProductsQuery } from '../api/queries';

const MIN_SEARCH_LENGTH = 2;

function ProductResultCard({ product }: { product: DropshippingProduct }) {
  return (
    <View className="mb-3 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
      <View className="h-[142px] items-center justify-center overflow-hidden bg-primary-light">
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Ionicons name="cube-outline" size={36} color={colors.primary} />
        )}
        {product.discount && product.discount > 0 ? (
          <View className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1">
            <Text className="text-[9px] font-bold text-white">
              {formatDropshippingNumber(product.discount)}% ছাড়
            </Text>
          </View>
        ) : null}
      </View>

      <View className="p-3">
        {product.brand ? (
          <Text numberOfLines={1} className="text-[10px] font-medium text-muted">
            {product.brand}
          </Text>
        ) : null}
        <Text
          numberOfLines={2}
          className={`text-[12px] font-bold leading-[18px] text-ink ${product.brand ? 'mt-1' : ''}`}
        >
          {product.name}
        </Text>

        <View className="mt-3 border-t border-line pt-2.5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-1">
              <Text className="text-[9px] text-muted">ড্রপশিপিং মূল্য</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[12px] font-extrabold text-primary-dark">
                {formatDropshippingTaka(product.dropshippingPrice ?? product.price)}
              </Text>
            </View>
            {product.dropshippingPrice !== undefined ? (
              <View className="flex-1 items-end pl-1">
                <Text className="text-[9px] text-muted">পণ্যের মূল্য</Text>
                <Text numberOfLines={1} className="mt-0.5 text-[11px] font-semibold text-ink">
                  {formatDropshippingTaka(product.price)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function EmptySearchState({
  hasSearch,
  isDebouncing,
}: {
  hasSearch: boolean;
  isDebouncing: boolean;
}) {
  if (!hasSearch) {
    return (
      <View className="items-center px-6 py-12">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
          <Ionicons name="search-outline" size={30} color={colors.primary} />
        </View>
        <Text className="mt-4 text-[14px] font-bold text-ink">পণ্য খুঁজুন</Text>
        <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
          পণ্যের নাম বা ব্র্যান্ড লিখে আপনার ড্রপশিপিং পণ্য খুঁজে নিন।
        </Text>
      </View>
    );
  }

  if (isDebouncing) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="mt-2 text-[11px] text-muted">খোঁজা হচ্ছে...</Text>
      </View>
    );
  }

  return (
    <View className="items-center px-6 py-12">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-bg">
        <Ionicons name="file-tray-outline" size={28} color={colors.muted} />
      </View>
      <Text className="mt-3 text-[13px] font-bold text-ink">কোনো পণ্য পাওয়া যায়নি</Text>
      <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
        বানান পরীক্ষা করে অন্য কোনো শব্দ দিয়ে আবার খুঁজুন।
      </Text>
    </View>
  );
}

export function DropshippingSearchScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const normalizedText = searchText.trim();
  const isDebouncing = normalizedText !== activeSearch;
  const query = useSearchDropshippingProductsQuery(activeSearch, page);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setActiveSearch(normalizedText);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [normalizedText]);

  const submitSearch = () => {
    Keyboard.dismiss();
    setActiveSearch(normalizedText);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchText('');
    setActiveSearch('');
    setPage(1);
  };

  const products = query.data?.products ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const hasSearch = activeSearch.length >= MIN_SEARCH_LENGTH;
  const showEmptyState = !hasSearch || (products.length === 0 && !query.isPending && !query.isError);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-ink">পণ্য খুঁজুন</Text>
          <Text className="mt-0.5 text-[10px] text-muted">ড্রপশিপিং ক্যাটালগ</Text>
        </View>
        {query.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <View className="px-4 pb-3 pt-4">
        <View className="overflow-hidden rounded-[22px] bg-primary px-4 py-4">
          <View className="absolute -right-5 -top-7 h-24 w-24 rounded-full bg-white/10" />
          <View className="flex-row items-center">
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <Ionicons name="search" size={22} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-extrabold text-white">আপনার পছন্দের পণ্য</Text>
              <Text className="mt-1 text-[10px] text-white/80">
                নাম বা ব্র্যান্ড দিয়ে খুঁজে দেখুন
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl border border-line bg-white px-3">
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            accessibilityLabel="পণ্য খুঁজুন"
            value={searchText}
            onChangeText={(value) => {
              setSearchText(value);
              setPage(1);
            }}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="পণ্যের নাম বা ব্র্যান্ড লিখুন"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="h-12 flex-1 px-2 text-[12px] text-ink"
          />
          {searchText.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="সার্চ মুছুন"
              onPress={clearSearch}
              className="h-9 w-9 items-center justify-center"
            >
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="পণ্য খুঁজুন"
            onPress={submitSearch}
            className="h-9 w-9 items-center justify-center rounded-xl bg-primary"
          >
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        {normalizedText.length === 1 ? (
          <Text className="mt-2 px-1 text-[10px] text-muted">
            খুঁজতে কমপক্ষে ২টি অক্ষর লিখুন।
          </Text>
        ) : null}
      </View>

      <FlatList
        data={showEmptyState || query.isError ? [] : products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-8"
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          hasSearch && query.data && !isDebouncing ? (
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold text-ink">
                {formatDropshippingNumber(query.data.totalCount)}টি পণ্য পাওয়া গেছে
              </Text>
              {query.data.totalPages > 1 ? (
                <Text className="text-[10px] text-muted">
                  পৃষ্ঠা {formatDropshippingNumber(query.data.page)} / {formatDropshippingNumber(query.data.totalPages)}
                </Text>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => <ProductResultCard product={item} />}
        ListEmptyComponent={
          query.isPending && hasSearch && !isDebouncing ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-3 text-[11px] text-muted">পণ্য খোঁজা হচ্ছে...</Text>
            </View>
          ) : query.isError && hasSearch ? (
            <View className="items-center rounded-2xl border border-red-100 bg-white px-5 py-6">
              <Ionicons name="cloud-offline-outline" size={28} color="#DC2626" />
              <Text className="mt-2 text-center text-[12px] font-semibold text-ink">
                {query.error.message || 'পণ্য লোড করা যায়নি।'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void query.refetch()}
                className="mt-3 rounded-xl bg-primary px-4 py-2.5"
              >
                <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
              </Pressable>
            </View>
          ) : (
            <EmptySearchState hasSearch={hasSearch} isDebouncing={isDebouncing} />
          )
        }
        ListFooterComponent={
          hasSearch && totalPages > 1 ? (
            <View className="mb-2 mt-1 flex-row items-center justify-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="আগের পৃষ্ঠা"
                disabled={page <= 1 || query.isFetching}
                onPress={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                className={`mr-3 h-10 w-10 items-center justify-center rounded-xl border border-line bg-white ${
                  page <= 1 || query.isFetching ? 'opacity-40' : ''
                }`}
              >
                <Ionicons name="chevron-back" size={18} color={colors.ink} />
              </Pressable>
              <Text className="text-[11px] font-semibold text-ink">
                {formatDropshippingNumber(page)} / {formatDropshippingNumber(totalPages)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="পরের পৃষ্ঠা"
                disabled={page >= totalPages || query.isFetching}
                onPress={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                className={`ml-3 h-10 w-10 items-center justify-center rounded-xl border border-line bg-white ${
                  page >= totalPages || query.isFetching ? 'opacity-40' : ''
                }`}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.ink} />
              </Pressable>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
