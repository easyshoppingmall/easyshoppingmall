import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../../shared/components/Header';
import { SearchBar } from '../../../shared/components/SearchBar';
import { BannerSlider } from '../../../shared/components/BannerSlider';
import { CategoryItem } from '../../../shared/components/CategoryItem';
import { ProductCard } from '../../../shared/components/ProductCard';
import { colors } from '../../../shared/theme/colors';
import { toBengaliNumber, type Product } from '../data/catalog';
import {
  getCenterBanners,
  getHomeProducts,
  getPopularProducts,
  getTopHomeBanners,
  getProductsForSubcategories,
} from '../api/homeApi';
import { catalogQueryKeys, useCategoriesQuery, useSubcategoriesQuery } from '../api/queries';

function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="mx-1 mb-3 flex-row items-center justify-between rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
      <Text className="mr-2 flex-1 text-[11px] text-red-700">{message}</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.75}>
        <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা</Text>
      </TouchableOpacity>
    </View>
  );
}

function queryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? `${fallback} ${error.message}`
    : fallback;
}

function SectionHeading({
  title,
  subtitle,
  image,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View className="mb-2.5 mt-5 flex-row items-end justify-between">
      <View className="flex-1 flex-row items-center">
        {image ? (
          <Image source={{ uri: image }} resizeMode="cover" className="mr-2 h-9 w-9 rounded-xl" />
        ) : null}
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-ink">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-[10px] text-muted">{subtitle}</Text> : null}
        </View>
      </View>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75} className="flex-row items-center">
          <Text className="text-[11px] font-semibold text-primary">সব দেখুন</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const categoriesQuery = useCategoriesQuery();
  const subcategoriesQuery = useSubcategoriesQuery();
  const bannersQuery = useQuery({
    queryKey: ['home', 'center-banners'],
    queryFn: getCenterBanners,
  });
  const topBannersQuery = useQuery({
    queryKey: ['home', 'top-banners'],
    queryFn: getTopHomeBanners,
  });
  const offersQuery = useQuery({
    queryKey: ['home', 'top-discounts'],
    queryFn: () => getHomeProducts({ limit: 20 }),
  });
  const popularProductsQuery = useQuery({
    queryKey: ['home', 'popular-products'],
    queryFn: () => getPopularProducts({ page: 1, limit: 10 }),
  });

  const subcategories = subcategoriesQuery.data ?? [];
  const subcategoryProductsQuery = useQuery({
    queryKey: [
      'home',
      'subcategory-products',
      subcategories.map((subcategory) => subcategory.id),
    ],
    queryFn: () => getProductsForSubcategories(subcategories),
    enabled: subcategories.length > 0,
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.categories }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.subcategories }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const handleProductPress = (product: Product) => {
    router.push({ pathname: '/(ecommerce)/product/[id]', params: { id: product.id } });
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/(ecommerce)/(tabs)/shop', params: { search: searchQuery.trim() } });
    }
  };

  const categories = categoriesQuery.data ?? [];
  const banners = bannersQuery.data ?? [];
  const offerProducts = (offersQuery.data ?? []).filter((product) => (product.discountPercent ?? 0) > 0);
  const subcategorySections = subcategoryProductsQuery.data?.sections ?? [];
  const subcategoryProductsLoading =
    subcategoriesQuery.isLoading ||
    (subcategories.length > 0 && subcategoryProductsQuery.isLoading);

  const homeHeader = (
    <View>
      <Header
        onProfilePress={() => router.push('/(ecommerce)/(tabs)/profile')}
        onCartPress={() => router.push('/(ecommerce)/(tabs)/cart')}
      />

      <SearchBar
        placeholder="আপনি কী খুঁজছেন?"
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearchSubmit}
        actionIcon="mic"
      />

      {topBannersQuery.isError ? (
        <QueryError
          message={queryErrorMessage(topBannersQuery.error, 'প্রধান ব্যানার লোড করা যায়নি।')}
          onRetry={() => void topBannersQuery.refetch()}
        />
      ) : topBannersQuery.data?.length ? (
        <BannerSlider
          banners={topBannersQuery.data}
          autoPlayInterval={3600}
        />
      ) : topBannersQuery.isLoading ? (
        <View className="mb-3 h-[170px] items-center justify-center rounded-[18px] bg-white">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      

      {categoriesQuery.isError ? (
        <QueryError
          message={queryErrorMessage(categoriesQuery.error, 'ক্যাটাগরি লোড করা যায়নি।')}
          onRetry={() => void categoriesQuery.refetch()}
        />
      ) : null}
      {categories.length > 0 ? (
        <>
          <SectionHeading
            title="ক্যাটাগরি অনুযায়ী খুঁজুন"
            onSeeAll={() => router.push('/(ecommerce)/(tabs)/shop')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {categories.map((category) => (
              <View key={category.id} className="w-[76px]">
                <CategoryItem
                  category={category}
                  onPress={() =>
                    router.push({
                      pathname: '/(ecommerce)/(tabs)/shop',
                      params: {
                        selectedCategoryId: category.id,
                        selectedCategory: category.name,
                      },
                    })
                  }
                />
              </View>
            ))}
          </ScrollView>
        </>
      ) : categoriesQuery.isLoading ? (
        <View className="h-[82px] items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      <SectionHeading
        title="সেরা অফার"
        subtitle="সবচেয়ে বেশি ছাড়ের পণ্যগুলো আগে দেখুন"
        onSeeAll={() => router.push('/(ecommerce)/(tabs)/shop')}
      />
      {offersQuery.isError ? (
        <QueryError
          message={queryErrorMessage(offersQuery.error, 'অফারের পণ্য লোড করা যায়নি।')}
          onRetry={() => void offersQuery.refetch()}
        />
      ) : offerProducts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4, paddingRight: 4 }}
        >
          {offerProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              horizontal
              onPress={handleProductPress}
            />
          ))}
        </ScrollView>
      ) : offersQuery.isLoading ? (
        <View className="h-[178px] items-center justify-center rounded-2xl bg-white">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View className="rounded-2xl border border-line bg-white px-4 py-5">
          <Text className="text-center text-[12px] text-muted">
            এই মুহূর্তে কোনো অফারের পণ্য নেই
          </Text>
        </View>
      )}

      <SectionHeading
        title="জনপ্রিয় পণ্য"
        subtitle="ক্রেতাদের পছন্দের পণ্য"
        onSeeAll={() => router.push('/(ecommerce)/(tabs)/shop')}
      />
      {popularProductsQuery.isError ? (
        <QueryError
          message={queryErrorMessage(popularProductsQuery.error, 'জনপ্রিয় পণ্য লোড করা যায়নি।')}
          onRetry={() => void popularProductsQuery.refetch()}
        />
      ) : popularProductsQuery.data?.products.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
          {popularProductsQuery.data.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              horizontal
              onPress={handleProductPress}
            />
          ))}
        </ScrollView>
      ) : popularProductsQuery.isLoading ? (
        <View className="h-[178px] items-center justify-center rounded-2xl bg-white">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      <SectionHeading title="আজকের বিশেষ আয়োজন" subtitle="নতুন অফার ও পছন্দের কালেকশন" />
      {bannersQuery.isError ? (
        <QueryError
          message={queryErrorMessage(bannersQuery.error, 'সেন্টার ব্যানার লোড করা যায়নি।')}
          onRetry={() => void bannersQuery.refetch()}
        />
      ) : banners.length > 0 ? (
        <BannerSlider
          banners={banners}
          onBannerPress={() => router.push('/(ecommerce)/(tabs)/shop')}
          autoPlayInterval={3600}
        />
      ) : bannersQuery.isLoading ? (
        <View className="h-[150px] items-center justify-center rounded-[18px] bg-white">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View className="rounded-2xl border border-line bg-white px-4 py-5">
          <Text className="text-center text-[12px] text-muted">
            কোনো সক্রিয় ব্যানার পাওয়া যায়নি
          </Text>
        </View>
      )}

      <SectionHeading
        title="আপনার পছন্দের কালেকশন"
        subtitle="প্রতিটি সাব-ক্যাটাগরির জনপ্রিয় পণ্য"
      />
      {subcategoriesQuery.isError ? (
        <QueryError
          message={queryErrorMessage(subcategoriesQuery.error, 'সাব-ক্যাটাগরি লোড করা যায়নি।')}
          onRetry={() => void subcategoriesQuery.refetch()}
        />
      ) : null}
      {subcategoryProductsQuery.isError ? (
        <QueryError
          message={queryErrorMessage(
            subcategoryProductsQuery.error,
            'সাব-ক্যাটাগরির পণ্য লোড করা যায়নি।'
          )}
          onRetry={() => void subcategoryProductsQuery.refetch()}
        />
      ) : null}
      {subcategoryProductsLoading ? (
        <View className="h-[120px] items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="mt-2 text-[11px] text-muted">আপনার জন্য পণ্য সাজানো হচ্ছে...</Text>
        </View>
      ) : null}
      {subcategoryProductsQuery.data?.errors.length ? (
        <Text className="mb-3 px-1 text-[10px] text-muted">
          {toBengaliNumber(subcategoryProductsQuery.data.errors.length)}টি সাব-ক্যাটাগরিতে সমস্যা:
          {' '}{subcategoryProductsQuery.data.errors.slice(0, 2).join(' · ')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={subcategorySections}
        keyExtractor={(section) => section.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28 }}
        ListHeaderComponent={homeHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item: section }) => (
          <View className="mb-2">
            <SectionHeading
              title={section.name}
              image={section.image}
              onSeeAll={() =>
                router.push({
                  pathname: '/(ecommerce)/(tabs)/shop',
                  params: {
                    selectedCategoryId: section.categoryId,
                    selectedCategory: '',
                    selectedSubcategoryId: section.id,
                    selectedSubcategory: section.name,
                  },
                })
              }
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4, paddingRight: 4 }}
            >
              {section.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  horizontal
                  onPress={handleProductPress}
                />
              ))}
            </ScrollView>
          </View>
        )}
        ListEmptyComponent={
          subcategoryProductsLoading ? null : subcategoriesQuery.isError ||
            subcategoryProductsQuery.isError ? null : (
              <View className="rounded-2xl border border-line bg-white px-4 py-5">
                <Text className="text-center text-[12px] text-muted">
                  এখনো কোনো সাব-ক্যাটাগরির পণ্য পাওয়া যায়নি
                </Text>
              </View>
            )
        }
      />
    </SafeAreaView>
  );
};

export default HomeScreen;
